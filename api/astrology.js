import Groq from "groq-sdk";
import {
  currentPlacements,
  astrocartographyChart,
  parseNatalLongitudes,
  currentTransitAspects,
} from "./_ephemeris.js";

const AREA_FOCUS = {
  career: "Focus on the 10th house / Midheaven, Saturn, the Sun, and Mars. Cover natural strengths, likely friction points, and what kind of work environment actually suits this chart.",
  friendships: "Focus on the 11th house, Uranus, Mercury, and the Moon. Cover how this person shows up in groups, what they need from friendships, and where they might over- or under-invest.",
  love: "Focus on the 7th and 5th houses, Venus, Mars, and the Moon. Cover attraction patterns, what they need to feel secure in a relationship, and a real (not flattering) blind spot.",
  finance: "Focus on the 2nd and 8th houses, Jupiter, and Saturn. Cover their natural relationship to money — earning style, risk tolerance, spending triggers — and one concrete, practical caution.",
};

// Which natal bodies are most relevant per life area — used to prioritize
// which real computed aspects to hand the model when there are many.
const AREA_KEY_BODIES = {
  career: ["Sun", "Saturn", "Mars", "Mercury", "Jupiter"],
  friendships: ["Moon", "Mercury", "Uranus", "Venus"],
  love: ["Venus", "Mars", "Moon", "Sun"],
  finance: ["Jupiter", "Saturn", "Venus", "Moon"],
};

function buildStandardPrompt(area) {
  return `You are an astrology interpreter. You will be given REAL, COMPUTED transit-to-natal aspect data — exact orbs and applying/separating trends calculated from actual planetary positions, not estimates. Your job is to interpret this data for the person's ${area} specifically, grounded entirely in what's given.

${AREA_FOCUS[area]}

Hard rules:
- Use ONLY the aspects listed in the data. Never invent an aspect, orb, or placement not explicitly given.
- Open by naming the single most exact (smallest-orb) relevant aspect and what it means concretely for ${area} — not generic sign-trait description.
- Explicitly distinguish NOW from SOON: if an aspect is "applying," say it's building/intensifying over the coming days and what to watch for; if "separating," say its peak influence has passed and what that means moving forward.
- Do not describe personality traits of the person's Sun/Moon/Rising sign in the abstract (no "Leos are natural leaders" type sentences) — every sentence should trace back to one of the specific computed aspects given.
- If stated goals are given and genuinely relevant, connect one specific aspect to progress on that goal concretely.
- 150-220 words, plain prose, no headers or bullet lists.
- End with one concrete, dated-feeling action for the next few days specifically (e.g. "over the next week, that's your window to...") — never vague encouragement like "stay positive."
- If NO relevant aspects are in the data, say so plainly and give the single most useful general observation available from what data does exist — do not fabricate an aspect to fill space.`;
}

function buildAstrocartographyPrompt(lines, hasLatitude) {
  return `You are interpreting real, computed astrocartography angles from actual astronomical data — not a generic horoscope, and not a topic to be cautious about. Below: for each of the 10 planets, its Midheaven (MC) and IC meridian longitudes${hasLatitude ? ", plus Ascendant/Descendant longitudes computed specifically at this person's birth latitude" : " (Ascendant/Descendant unavailable — birth latitude wasn't provided, so lean more heavily on MC/IC)"}.

Rules:
- ONE sentence only, right at the start, noting this uses real computed angles but isn't a full rendered map (full ASC/DSC curves vary by latitude). Do not repeat or expand on this caveat again anywhere else in the response — say it once and move on to substance.
- Cover 4 planets, not 2-3: pick the most practically significant ones from Sun, Moon, Venus, Jupiter, Saturn, Mars based on which have the most notable (closest to 0/90/180) longitude values in the data.
- For EACH of those 4, name the actual longitude number and use real geography knowledge to identify which specific region/country/city that meridian passes through or near — commit to a real place, don't just say "a region." You can hedge on exact precision without hedging on substance — e.g. "your Jupiter MC sits near 45°E, which runs through the Horn of Africa up through western Russia — Nairobi and Moscow are both roughly on this line" is good; "somewhere in that general area" is not.
- For each planet covered, say concretely what that placement there tends to mean (MC = public/career direction, IC = home/roots, ASC = personal identity/how you show up, DSC = relationships/partnerships) and connect it to something practically useful.
- 180-250 words, plain prose, no headers or bullet lists, no repeated caveats.
- End with one concrete suggestion using an actual place name from the data (e.g. "if you're ever choosing between two cities for work, lean toward the one nearer your Jupiter line").

Computed data (longitudes in degrees, -180 to 180, east positive):
${JSON.stringify(lines)}`;
}

// This entire handler is wrapped so that literally any failure — a bad
// import, a math error, a Groq outage — still comes back as valid JSON with
// a real status code. Letting an exception escape here means Vercel/Node
// returns a plain-text crash page, which breaks res.json() on the frontend
// with an opaque parse error instead of showing the actual problem.
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { area, profile, for_date } = req.body || {};
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
        return res.status(500).json({ error: `Couldn't compute astrocartography lines: ${err.message}` });
      }
      systemPrompt = buildAstrocartographyPrompt(lines, profile.birth_lat != null);
    } else {
      const natalLongitudes = parseNatalLongitudes(profile?.natal_chart_notes || "");
      const hasNatalDegrees = Object.keys(natalLongitudes).length > 0;

      if (!hasNatalDegrees && !profile?.sun_sign) {
        return res.status(400).json({ error: "No chart data on this profile yet. Add Sun/Moon/Rising in Settings first." });
      }

      let dataBlock;
      const now = new Date();

      if (hasNatalDegrees) {
        // Real degree data available — compute actual aspects, not just signs.
        const allAspects = currentTransitAspects(natalLongitudes, now, 5);
        const keyBodies = AREA_KEY_BODIES[area] || [];
        const relevant = allAspects.filter((a) => keyBodies.includes(a.natalBody));
        const chosen = (relevant.length ? relevant : allAspects).slice(0, 6);

        const todayPositions = currentPlacements(now);
        const positionsLine = Object.entries(todayPositions)
          .map(([body, { sign, degreeInSign }]) => `${body} ${degreeInSign.toFixed(1)}° ${sign}`)
          .join(", ");

        const aspectLines = chosen.length
          ? chosen
              .map(
                (a) =>
                  `Transiting ${a.transitBody} ${a.aspect} natal ${a.natalBody} — orb ${a.orb}°, ${a.trend}`
              )
              .join("\n")
          : "No major aspects (within standard orb) between today's transits and this chart's key placements for this area right now.";

        dataBlock = `Today's exact transiting positions: ${positionsLine}\n\nActive transit-to-natal aspects relevant to ${area} (real computed data, sorted tightest first):\n${aspectLines}`;
      } else {
        // No parseable natal degrees — fall back to sign-level data only.
        // Explicitly tell the model this is lower precision so it doesn't
        // fabricate exact-degree claims it doesn't actually have.
        const todayPositions = currentPlacements(now);
        const positionsLine = Object.entries(todayPositions)
          .map(([body, { sign }]) => `${body} in ${sign}`)
          .join(", ");
        dataBlock = `NOTE: only sign-level natal data available (no exact degrees), so precise aspects can't be computed — do not claim exact orbs or "applying/separating" status.\n\nNatal: Sun ${profile.sun_sign || "?"}, Moon ${profile.moon_sign || "?"}, Rising ${profile.rising_sign || "?"}\nToday's transiting signs: ${positionsLine}`;
      }

      const goalsLine = profile?.core_goals ? `\n\nTheir stated goals right now: ${profile.core_goals}` : "";

      systemPrompt = buildStandardPrompt(area);
      userContent = `${dataBlock}${goalsLine}`;
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 700,
    });

    const content = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!content) {
      console.error("Groq returned empty content for astrology reading. Full completion:", JSON.stringify(completion));
      return res.status(502).json({
        error: `The model returned an empty response (finish_reason: ${completion.choices?.[0]?.finish_reason || "unknown"}). Try again.`,
      });
    }
    return res.status(200).json({ area, content, for_date: for_date || new Date().toISOString().slice(0, 10) });
  } catch (err) {
    const detail = err?.error?.message || err?.message || "Unknown server error";
    console.error("Astrology endpoint crashed:", err);
    return res.status(500).json({ error: `Reading failed: ${detail}` });
  }
}
