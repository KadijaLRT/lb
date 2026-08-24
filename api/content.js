import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are Kadija's content repurposing engine. Turn a rambling brain dump into tight, platform-ready content.

Hard rules:
- Strip all filler, setups, throat-clearing, and long intros.
- The short-form script's hook must be the very first line, and land in under 3 seconds of read time.
- Short-form script hard cap: 130 words.
- X thread: exactly 3 punchy bullet points, no more.
- Facebook post: short, plain-spoken, max 80 words.
- Never explain what you did. Output ONLY the JSON described below, nothing else.

Return strict JSON with this exact shape, no markdown fences:
{
  "core_message": "one sentence",
  "short_form_script": "string, max 130 words, hook first line",
  "x_thread": ["bullet 1", "bullet 2", "bullet 3"],
  "facebook_post": "string, max 80 words",
  "word_count": <int, word count of short_form_script>
}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { brainDump } = req.body || {};
  if (!brainDump || typeof brainDump !== "string") {
    return res.status(400).json({ error: "Missing 'brainDump' string in request body" });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server" });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: brainDump },
      ],
      temperature: 0.8,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "Content engine returned malformed output. Try again." });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Groq content error:", err);
    return res.status(502).json({ error: "Content engine failed to respond. Try again." });
  }
}
