import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const AREA_FOCUS = {
  career: "Focus on the 10th house / Midheaven, Saturn, the Sun, and Mars. Cover natural strengths, likely friction points, and what kind of work environment actually suits this chart.",
  friendships: "Focus on the 11th house, Uranus, Mercury, and the Moon. Cover how this person shows up in groups, what they need from friendships, and where they might over- or under-invest.",
  love: "Focus on the 7th and 5th houses, Venus, Mars, and the Moon. Cover attraction patterns, what they need to feel secure in a relationship, and a real (not flattering) blind spot.",
  finance: "Focus on the 2nd and 8th houses, Jupiter, and Saturn. Cover their natural relationship to money — earning style, risk tolerance, spending triggers — and one concrete, practical caution.",
  astrocartography: "IMPORTANT: you cannot calculate real astrocartography lines without a proper geographic ephemeris tool, and you must say so plainly, once, near the top. Then give conceptual guidance only: based on the chart's dominant planets and houses, describe the *kind* of place/energy that tends to suit this person (e.g. Leo/Sun-dominant charts often thrive somewhere they can be visible and lead). Do not name specific cities or claim precise line crossings.",
};

function systemPromptFor(area) {
  return `You are an astrology interpreter working from a real natal chart. Be specific to the data given — reference actual placements by name, not generic sun-sign horoscope language. Be direct, useful, and skip disclaimers except where noted.

${AREA_FOCUS[area]}

Rules:
- 150-220 words, plain prose, no headers or bullet lists.
- Reference at least 2 specific placements or aspects from the chart data given.
- End with one concrete, actionable line — not vague encouragement.
- Never invent placements not present in the data. If the natal chart data is thin, work with what's given (Sun/Moon/Rising) and say so rather than fabricating detail.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { area, profile } = req.body || {};
  if (!area || !AREA_FOCUS[area]) {
    return res.status(400).json({ error: `Missing or invalid 'area'. Must be one of: ${Object.keys(AREA_FOCUS).join(", ")}` });
  }
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server" });
  }

  const chartLines = [
    profile?.sun_sign && `Sun: ${profile.sun_sign}`,
    profile?.moon_sign && `Moon: ${profile.moon_sign}`,
    profile?.rising_sign && `Rising: ${profile.rising_sign}`,
    profile?.natal_chart_notes && `Full chart notes: ${profile.natal_chart_notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!chartLines) {
    return res.status(400).json({ error: "No chart data on this profile yet. Add Sun/Moon/Rising in Settings first." });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPromptFor(area) },
        { role: "user", content: `Natal chart data:\n${chartLines}` },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = completion.choices?.[0]?.message?.content?.trim() || "";
    return res.status(200).json({ area, content });
  } catch (err) {
    const detail = err?.error?.message || err?.message || "Unknown Groq error";
    console.error("Astrology insight error:", detail);
    return res.status(502).json({ error: `Reading failed: ${detail}` });
  }
}
