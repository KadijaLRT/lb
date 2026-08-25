import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are Kadija's content repurposing engine. Turn a rambling brain dump into tight, platform-ready content.

Hard rules:
- Strip all filler, setups, throat-clearing, and long intros.
- The short-form script's hook must be the very first line, and land in under 3 seconds of read time.
- Short-form script hard cap: 130 words.
- X thread: exactly 3 punchy bullet points, no more.
- Facebook post: short, plain-spoken, max 80 words.
- Never explain what you did. Output ONLY the JSON described below, nothing else, no markdown fences.

Return strict JSON with this exact shape:
{
  "core_message": "one sentence",
  "short_form_script": "string, max 130 words, hook first line",
  "x_thread": ["bullet 1", "bullet 2", "bullet 3"],
  "facebook_post": "string, max 80 words",
  "word_count": <int, word count of short_form_script>
}`;

// Some models/providers ignore response_format or wrap JSON in prose or
// fences despite instructions. Pull the first {...} block out defensively
// instead of trusting the raw string to be valid JSON on its own.
function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

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

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: brainDump },
      ],
      temperature: 0.8,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });
  } catch (err) {
    // Surface Groq's actual error instead of a bare 502 — this is almost
    // always an auth, model-name, or rate-limit issue and the message tells
    // you which.
    const detail = err?.error?.message || err?.message || "Unknown Groq error";
    console.error("Groq content API call failed:", detail);
    return res.status(502).json({ error: `Content engine call failed: ${detail}` });
  }

  const raw = completion.choices?.[0]?.message?.content?.trim() || "";
  const parsed = extractJson(raw);

  if (!parsed) {
    console.error("Groq content response was not parseable JSON:", raw.slice(0, 500));
    return res.status(502).json({ error: "Content engine returned unparseable output. Try again." });
  }

  return res.status(200).json(parsed);
}
