import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const config = {
  api: { bodyParser: { sizeLimit: "35mb" } },
};

const MAX_IMAGES = 5;

const EXTRACT_PROMPT = `You're extracting a natal chart from one or more screenshots of an astrology report
(planet position tables, house tables, and/or aspect tables). The screenshots may be
partial or overlapping — combine everything you see across all of them into one chart.
Ignore any prose/interpretation text, ads, or navigation chrome.

Output ONLY a compact, structured plain-text summary — no commentary, no markdown fences.

Format exactly like this, one line per item, only including what's actually visible in the images:
Sun: <sign> <degrees> (House <roman numeral>)
Moon: <sign> <degrees> (House <roman numeral>)
Mercury: <sign> <degrees> (House <roman numeral>)
Venus: <sign> <degrees> (House <roman numeral>)
Mars: <sign> <degrees> (House <roman numeral>)
Jupiter: <sign> <degrees> (House <roman numeral>)
Saturn: <sign> <degrees> (House <roman numeral>)
Uranus: <sign> <degrees> (House <roman numeral>)
Neptune: <sign> <degrees> (House <roman numeral>)
Pluto: <sign> <degrees> (House <roman numeral>)
Ascendant: <sign> <degrees>
Midheaven: <sign> <degrees>
Houses: <cusp signs for II through XII, comma separated>
Aspects: <list each as "Planet Aspect Planet (value)", comma separated, only major ones with |value| > 10>

If birth date, time, or location are visible anywhere in the screenshots, add these two lines at the end:
Birth: <date>, <time>, <location>
Coordinates: <latitude>, <longitude>

If a screenshot is unreadable or doesn't contain chart data, just skip it — don't mention that in the output.`;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { images } = req.body || {};
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "Missing 'images' — send an array of base64 data URLs." });
    }
    if (images.length > MAX_IMAGES) {
      return res.status(400).json({ error: `Max ${MAX_IMAGES} screenshots per request. Sent ${images.length}.` });
    }
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server" });
    }

    const content = [
      { type: "text", text: EXTRACT_PROMPT },
      ...images.map((dataUrl) => ({ type: "image_url", image_url: { url: dataUrl } })),
    ];

    const completion = await groq.chat.completions.create({
      model: "qwen/qwen3.6-27b",
      messages: [{ role: "user", content }],
      temperature: 0.2,
      max_tokens: 900,
    });

    const notes = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!notes) {
      return res.status(502).json({ error: "Couldn't read chart data from those screenshots. Try clearer/closer crops." });
    }
    return res.status(200).json({ notes });
  } catch (err) {
    const detail = err?.error?.message || err?.message || "Unknown server error";
    console.error("Screenshot parse endpoint crashed:", err);
    return res.status(500).json({ error: `Screenshot parsing failed: ${detail}` });
  }
}
