import Groq from "groq-sdk";
import { currentPlacements, astrocartographyChart } from "./_ephemeris.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const AREA_FOCUS = {
  career: "Focus on the 10th house / Midheaven, Saturn, the Sun, and Mars. Cover natural strengths, likely friction points, and what kind of work environment actually suits this chart.",
  friendships: "Focus on the 11th house, Uranus, Mercury, and the Moon. Cover how this person shows up in groups, what they need from friendships, and where they might over- or under-invest.",
  love: "Focus on the 7th and 5th houses, Venus, Mars, and the Moon. Cover attraction patterns, what they need to feel secure in a relationship, and a real (not flattering) blind spot.",
  finance: "Focus on the 2nd and 8th houses, Jupiter, and Saturn. Cover their natural relationship to money — earning style, risk tolerance, spending triggers — and one concrete, practical caution.",
};

function todayTransitLine() {
  const p = currentPlacements(new Date());
  return Object.entries(p)
    .map(([body, { sign }]) => `${body}: ${sign}`)
    .join(", ");
}

function buildStandardPrompt(area) {
  return `You are an astrology interpreter working from a real natal chart AND today's real transiting positions. Be specific — reference actual natal placements by name, and explicitly say how at least one of TODAY's transits is activating or interacting with the relevant natal placement for this life area. This must read as a reading for RIGHT NOW, not a generic lifelong personality summary.

${AREA_FOCUS[area]}

Rules:
- 150-220 words, plain prose, no headers or bullet lists.
- Reference at least 2 specific natal placements/aspects AND at least 1 specific transiting placement from today's data.
- End with one concrete, actionable line for today or this week specifically — not vague encouragement.
- Never invent placements not present in the data given. If natal chart data is thin, work with Sun/Moon/Rising and say so rather than fabricating detail.`;
}

function buildAstrocartographyPrompt(lines, hasLatitude) {
  return `You are interpreting real, computed astrocartography angles (not a generic horoscope). Below is actual astronomical data: for each planet, its Midheaven (MC) and IC meridian longitudes${hasLatitude ? ", plus Ascendant/Descendant longitudes computed specifically at this person's birth latitude" : ""}.

Rules:
- State plainly, once, near the top: these are real computed angles but this is NOT a full rendered map — full curved ASC/DSC lines vary by latitude and are best viewed with a dedicated astrocartography mapping tool.
- Pick the 2-3 most emotionally/practically significant planets for astrocartography purposes (Sun, Moon, Venus, Jupiter, Saturn are usually most relevant) and describe, using your general geography knowledge, the rough longitude band / regions those lines pass through — hedge this clearly as approximate, never claim a precise city.
- Connect it to something practical: where might this person feel most "themselves," most driven, or should be cautious, based on which planet's line is nearby.
- 150-220 words, plain prose, no headers or bullet lists.
- End with one concrete suggestion (e.g. "if you're ever choosing between two cities for work, lean toward the one closer to your Jupiter line").

Computed data:
${JSON.stringify(lines)}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { area, profile } = req.body || {};
  const validAreas = [...Object.keys(AREA_FOCUS), "astrocartography"];
  if (!area || !validAreas.includes(area)) {
    return res.status(400).json({ error: `Missing or invalid 'area'. Must be one of: ${validAreas.join(", ")}` });
  }
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server" });
  }

  let systemPrompt;
  let userContent = "Generate the reading from the computed data above.";

  if (area === "astrocartography") {
    if (!profile?.birth_date || profile?.birth_utc_offset == null) {
      return res.status(400).json({
        error: "Astrocartography needs your birth date and UTC offset — add them in Settings first.",
      });
    }
    const time = profile.birth_time || "12:00";
    const localDate = new Date(`${profile.birth_date}T${time}:00`);
    if (Number.isNaN(localDate.getTime())) {
      return res.status(400).json({ error: "Couldn't parse your stored birth date/time." });
    }
    const birthUTC = new Date(localDate.getTime() - Number(profile.birth_utc_offset) * 60 * 60 * 1000);
    let lines;
    try {
      lines = astrocartographyChart(birthUTC, profile.birth_lat != null ? Number(profile.birth_lat) : null);
    } catch (err) {
      console.error("Astrocartography computation failed:", err.message);
      return res.status(500).json({ error: "Couldn't compute astrocartography lines." });
    }
    systemPrompt = buildAstrocartographyPrompt(lines, profile.birth_lat != null);
  } else {
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

    systemPrompt = buildStandardPrompt(area);
    userContent = `Natal chart data:\n${chartLines}\n\nToday's transiting placements:\n${todayTransitLine()}`;
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = completion.choices?.[0]?.message?.content?.trim() || "";
    return res.status(200).json({ area, content, for_date: new Date().toISOString().slice(0, 10) });
  } catch (err) {
    const detail = err?.error?.message || err?.message || "Unknown Groq error";
    console.error("Astrology insight error:", detail);
    return res.status(502).json({ error: `Reading failed: ${detail}` });
  }
}
