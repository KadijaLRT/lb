import Groq from "groq-sdk";

const SYSTEM_PROMPT = `You are a content strategist generating actual post ideas optimized for engagement, not generic topic suggestions. You know what performs well on TikTok/Reels/X/Facebook: relatable pain points, specific "before/after" or "here's what nobody tells you" framings, mild controversy grounded in genuine opinion, listicles with a twist, and personal-stakes storytelling beat generic advice every time.

Rules:
- Generate exactly 5 ideas.
- Each idea must be a SPECIFIC angle, not a topic. Bad: "talk about productivity." Good: "The productivity advice that actually made things worse for me, and what I do instead."
- Each idea needs a ready-to-use hook line (the literal first sentence someone would say/write) — not a description of a hook, the actual hook text.
- Vary the format across the 5: mix at least one listicle-style, one personal story/confession, one contrarian/hot-take, one "here's exactly how" tutorial-style, and one relatable-pain-point.
- best_platform: pick the ONE platform (TikTok, Instagram, X, or Facebook) this specific angle would perform best on, and say why in one short phrase.
- If the person's context (goals, interests, chart) is given, let it inform the ideas' subject matter where genuinely relevant — but the ideas should still feel personal and specific, not generic astrology or goal-tracking content.
- Never explain what you did. Output ONLY the JSON below, no markdown fences.

Return strict JSON:
{
  "ideas": [
    { "hook": "the literal first line", "angle": "one sentence describing the full idea", "format": "listicle | confession | hot-take | tutorial | pain-point", "best_platform": "TikTok | Instagram | X | Facebook", "why": "one short phrase on why this platform" }
  ]
}`;

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

    const { profile, seedTopic } = req.body || {};
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server" });
    }

    const contextLines = [
      profile?.name && `Name: ${profile.name}`,
      profile?.core_goals && `Current goals: ${profile.core_goals}`,
      seedTopic && `They specifically want ideas related to: ${seedTopic}`,
    ]
      .filter(Boolean)
      .join("\n");

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: contextLines || "No specific context given — generate broadly appealing, format-diverse ideas.",
          },
        ],
        temperature: 0.9,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      });
    } catch (err) {
      const detail = err?.error?.message || err?.message || "Unknown Groq error";
      console.error("Groq idea generation failed:", detail);
      return res.status(502).json({ error: `Idea generation failed: ${detail}` });
    }

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    const parsed = extractJson(raw);
    if (!parsed?.ideas?.length) {
      const finishReason = completion.choices?.[0]?.finish_reason;
      console.error(`No ideas parsed from Groq response (finish_reason: ${finishReason}):`, raw.slice(0, 500));
      return res.status(502).json({
        error:
          finishReason === "length"
            ? "Idea generation was cut off before finishing (hit length limit). Try again."
            : "Couldn't generate ideas. Try again.",
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    const detail = err?.error?.message || err?.message || "Unknown server error";
    console.error("Content ideas endpoint crashed:", err);
    return res.status(500).json({ error: `Idea generation failed: ${detail}` });
  }
}
