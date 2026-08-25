import Groq from "groq-sdk";

const SYSTEM_PROMPT = `You are Kadija's content repurposing engine AND content coach, specifically optimizing for engagement across TikTok, Instagram, X, and Facebook. Turn a rambling brain dump into tight, platform-native content, then give exact execution steps.

Hard rules:
- Strip all filler, setups, throat-clearing, and long intros.
- tiktok_reels_script: hook must be the very first line and land in under 3 seconds of read time. Hard cap 130 words. This same script also works for IG/FB Reels — don't write a separate video script for Instagram.
- instagram_caption: NOT the video script — this is the caption that goes under the post/reel. Short, punchy first line (gets cut off after ~125 chars so front-load it), a line break, then 1-3 more lines. Include exactly 5 relevant hashtags at the end, mix of broad and niche.
- x_thread: exactly 3 punchy bullet points, no more. First one must work as a standalone hook.
- facebook_post: short, plain-spoken, max 80 words. Facebook rewards conversational tone and questions more than TikTok/IG do — lean into that.
- execution_steps: exactly 4-6 steps, EXTREMELY concrete and ADHD-friendly — no step should require more than one decision. Bad: "Film the video." Good: "Say hook line 1 straight into the camera, no retakes unless you flub words." Include the actual posting-time recommendation as one step (e.g. "Post between 6-9pm local time for best reach") and one step about early engagement (e.g. "Reply to the first 5 comments within 30 min — this signals the algorithm to push it further").
- core_message and engagement_tip: write these like a friend texting quick honest notes, not a strategist's memo — direct, warm, a little personality. "this hook's solid but the ending's flat" beats "the concluding statement could be strengthened."
- engagement_tip: one sentence of the single highest-leverage thing about THIS specific piece — could be about the hook strength, format choice, timing, or a concrete CTA to add. Not generic advice.
- If the person's context (name, goals, natal chart) is given, let it inform tone/voice ONLY if genuinely useful. Never mention astrology explicitly in the actual content output, and never force a connection to their goals if it doesn't fit.
- Never explain what you did. Output ONLY the JSON described below, nothing else, no markdown fences.

Return strict JSON with this exact shape:
{
  "core_message": "one sentence",
  "tiktok_reels_script": "string, max 130 words, hook first line",
  "instagram_caption": "string with line breaks, ending in exactly 5 hashtags",
  "x_thread": ["bullet 1 (hook)", "bullet 2", "bullet 3"],
  "facebook_post": "string, max 80 words, conversational",
  "execution_steps": ["step 1", "step 2", "..."],
  "engagement_tip": "one sentence, specific to this piece",
  "word_count": <int, word count of tiktok_reels_script>
}`;

export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } },
};

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
  try {
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

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(contextLines ? [{ role: "system", content: `Creator context (use subtly, never state directly):\n${contextLines}` }] : []),
          { role: "user", content: brainDump },
        ],
        temperature: 0.8,
        max_tokens: 1600,
        response_format: { type: "json_object" },
      });
    } catch (err) {
      const detail = err?.error?.message || err?.message || "Unknown Groq error";
      console.error("Groq content API call failed:", detail);
      return res.status(502).json({ error: `Content engine call failed: ${detail}` });
    }

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    const parsed = extractJson(raw);

    if (!parsed) {
      const finishReason = completion.choices?.[0]?.finish_reason;
      console.error(`Groq content response was not parseable JSON (finish_reason: ${finishReason}):`, raw.slice(0, 500));
      return res.status(502).json({
        error:
          finishReason === "length"
            ? "Content engine response was cut off before finishing (hit length limit). Try a shorter brain dump, or try again."
            : "Content engine returned unparseable output. Try again.",
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    const detail = err?.error?.message || err?.message || "Unknown server error";
    console.error("Content endpoint crashed:", err);
    return res.status(500).json({ error: `Content engine failed: ${detail}` });
  }
}
