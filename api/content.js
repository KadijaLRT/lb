import Groq from "groq-sdk";

const SYSTEM_PROMPT = `You are Kadija's content repurposing engine AND content coach. Turn a rambling brain dump into tight, platform-ready content, then coach the delivery.

Hard rules:
- Strip all filler, setups, throat-clearing, and long intros.
- The short-form script's hook must be the very first line, and land in under 3 seconds of read time.
- Short-form script hard cap: 130 words.
- X thread: exactly 3 punchy bullet points, no more.
- Facebook post: short, plain-spoken, max 80 words.
- If the person's context (name, goals, natal chart) is given, let it inform tone/voice ONLY if genuinely useful — e.g. a Leo Sun/Mercury person often reads well with a bold, direct voice. Never mention astrology explicitly in the actual content output, and never force a connection to their goals if it doesn't fit.
- coaching_tip: one sentence of concrete platform-posting advice specific to THIS piece of content (e.g. best format choice, a timing/cadence note, or a hook improvement) — not generic "post consistently" advice.
- Never explain what you did. Output ONLY the JSON described below, nothing else, no markdown fences.

Return strict JSON with this exact shape:
{
  "core_message": "one sentence",
  "short_form_script": "string, max 130 words, hook first line",
  "x_thread": ["bullet 1", "bullet 2", "bullet 3"],
  "facebook_post": "string, max 80 words",
  "word_count": <int, word count of short_form_script>,
  "coaching_tip": "one sentence, specific to this piece"
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

  const { brainDump, profile } = req.body || {};
  if (!brainDump || typeof brainDump !== "string") {
    return res.status(400).json({ error: "Missing 'brainDump' string in request body" });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server" });
  }

  const contextLines = profile
    ? [
        profile.name && `Name: ${profile.name}`,
        profile.core_goals && `Current goals: ${profile.core_goals}`,
        (profile.sun_sign || profile.moon_sign) &&
          `Chart: Sun ${profile.sun_sign || "?"}, Moon ${profile.moon_sign || "?"}, Rising ${profile.rising_sign || "?"}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  let completion;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(contextLines ? [{ role: "system", content: `Creator context (use subtly, never state directly):\n${contextLines}` }] : []),
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
