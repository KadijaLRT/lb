import pdf from "pdf-parse";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

const CONDENSE_PROMPT = `You're extracting a natal chart from raw, messy report text (likely from an astrology
report site, full of prose interpretation you should ignore). Output ONLY a compact,
structured plain-text summary — no commentary, no markdown fences.

Format exactly like this, one line per item, only including what's actually present in the source:
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

If birth date, time, or location appear in the source, add these two lines at the end:
Birth: <date>, <time>, <location>
Coordinates: <latitude>, <longitude>`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pdfBase64 } = req.body || {};
  if (!pdfBase64) {
    return res.status(400).json({ error: "Missing 'pdfBase64' in request body" });
  }

  let rawText;
  try {
    const buffer = Buffer.from(pdfBase64, "base64");
    const parsed = await pdf(buffer);
    rawText = parsed.text?.trim();
  } catch (err) {
    console.error("PDF parse failed:", err.message);
    return res.status(400).json({ error: "Couldn't read that PDF. Is it a valid, unencrypted file?" });
  }

  if (!rawText) {
    return res.status(400).json({ error: "No extractable text found in that PDF." });
  }

  if (!process.env.GROQ_API_KEY) {
    // Still useful without Groq — just hand back the raw extracted text.
    return res.status(200).json({ notes: rawText.slice(0, 6000), condensed: false });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: CONDENSE_PROMPT },
        { role: "user", content: rawText.slice(0, 15000) },
      ],
      temperature: 0.2,
      max_tokens: 900,
    });
    const notes = completion.choices?.[0]?.message?.content?.trim() || rawText.slice(0, 6000);
    return res.status(200).json({ notes, condensed: true });
  } catch (err) {
    console.error("Groq condense failed, returning raw text:", err.message);
    return res.status(200).json({ notes: rawText.slice(0, 6000), condensed: false });
  }
}
