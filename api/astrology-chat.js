import Groq from "groq-sdk";
import { currentPlacements, parseNatalLongitudes, currentTransitAspects } from "./_ephemeris.js";

const AREA_KEY_BODIES = {
  career: ["Sun", "Saturn", "Mars", "Mercury", "Jupiter"],
  friendships: ["Moon", "Mercury", "Uranus", "Venus"],
  love: ["Venus", "Mars", "Moon", "Sun"],
  finance: ["Jupiter", "Saturn", "Venus", "Moon"],
};

// Same real-aspect grounding used by the reading itself — recomputed fresh
// so follow-up answers stay tied to the actual chart, not just whatever
// the model remembers saying a moment ago.
function buildGroundingBlock(area, profile) {
  const natalLongitudes = parseNatalLongitudes(profile?.natal_chart_notes || "");
  const now = new Date();

  if (Object.keys(natalLongitudes).length === 0) {
    const todayPositions = currentPlacements(now);
    const positionsLine = Object.entries(todayPositions)
      .map(([b, { sign }]) => `${b} in ${sign}`)
      .join(", ");
    return `NOTE: only sign-level data available, no exact degrees — don't claim precise timing or orbs.\nNatal: Sun ${profile?.sun_sign || "?"}, Moon ${profile?.moon_sign || "?"}, Rising ${profile?.rising_sign || "?"}\nToday's transiting signs: ${positionsLine}`;
  }

  const allAspects = currentTransitAspects(natalLongitudes, now, 5);
  const keyBodies = area && AREA_KEY_BODIES[area] ? AREA_KEY_BODIES[area] : null;
  const relevant = keyBodies ? allAspects.filter((a) => keyBodies.includes(a.natalBody)) : allAspects;
  const chosen = (relevant.length ? relevant : allAspects).slice(0, 8);

  if (!chosen.length) return "No major real aspects active right now for this chart.";
  return `Real computed current aspects:\n${chosen.map((a) => `Transiting ${a.transitBody} ${a.aspect} natal ${a.natalBody} — ${a.trend}`).join("\n")}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { area, profile, priorReading, messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing 'messages' array." });
    }
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server" });
    }

    const grounding = buildGroundingBlock(area, profile);

    const systemPrompt = `You are continuing a conversation about this person's astrology chart${area ? ` (focused on ${area})` : ""}. You already gave them a reading; now they're asking follow-up questions.

Stay grounded ONLY in the real computed aspect data given below — never invent a new aspect, placement, or degree. If they ask about something the given data doesn't cover, say so honestly rather than making something up to seem more helpful.

Voice: warm friend, plain everyday language, ADHD-friendly — short sentences, one idea at a time, no astrology jargon left unexplained ("orb," "transiting," "natal," "applying," "separating" always need a plain-English translation in the same breath if used at all). This is a real back-and-forth conversation, not another full reading — keep replies SHORT, typically 2-4 sentences, focused on exactly what they asked. If something actionable fits, give one concrete plain suggestion, not a list.

The reading they already received: "${priorReading || "(not provided)"}"

${grounding}`;

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 500,
    });

    let reply = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!reply) {
      return res.status(502).json({
        error: `The model returned an empty response (finish_reason: ${completion.choices?.[0]?.finish_reason || "unknown"}). Try again.`,
      });
    }
    if (completion.choices?.[0]?.finish_reason === "length") {
      const lastSentenceEnd = Math.max(reply.lastIndexOf("."), reply.lastIndexOf("!"), reply.lastIndexOf("?"));
      if (lastSentenceEnd > -1) reply = reply.slice(0, lastSentenceEnd + 1);
    }

    return res.status(200).json({ reply });
  } catch (err) {
    const detail = err?.error?.message || err?.message || "Unknown server error";
    console.error("Astrology chat endpoint crashed:", err);
    return res.status(500).json({ error: `Reply failed: ${detail}` });
  }
}
