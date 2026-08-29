import Groq from "groq-sdk";
import { currentPlacements, parseNatalLongitudes, parseHousePlacements, parseNatalAspects, currentTransitAspects } from "./_ephemeris.js";

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
  return `You are talking directly to this person like a perceptive friend who happens to know astrology well — not writing a formal report. You will be given REAL, COMPUTED transit-to-natal aspect data — exact orbs and applying/separating trends calculated from actual planetary positions, not estimates. Your job is to interpret this data for the person's ${area} specifically, grounded entirely in what's given.

${AREA_FOCUS[area]}

Voice:
- Second person, warm, conversational. Contractions. Like you're telling a friend something you noticed about their chart over coffee, not delivering a printout.
- Still direct — warmth doesn't mean softening real observations, including ones that aren't flattering. A good friend tells you the truth kindly, not vaguely.
- PLAIN LANGUAGE, ADHD-friendly: one idea per sentence, short sentences, no stacked clauses. Never use "orb," "transiting," "natal," "applying," or "separating" as standalone jargon — if you reference degree-closeness or timing, say it in plain words instead (e.g. "this is exact right now" instead of "0.2° orb"; "still building over the next few days" instead of "applying"; "already past its peak" instead of "separating"). You can and should name the planets and the general idea of an aspect (e.g. "Saturn is putting pressure on your Sun") — just never the technical measurement language around it. A reader with zero astrology background should follow every sentence.

Hard rules for the "reading" field:
- Use ONLY the aspects listed in the data — both the today's transit aspects AND this chart's own permanent natal aspects, whichever are given. Never invent an aspect, degree, or placement not explicitly given, and never skip real data that's provided in favor of a generic assumption.
- You'll be given TWO kinds of aspects: transit-to-natal (today's temporary activation — these change day to day) and natal-to-natal (permanent aspects between this person's own planets — these never change, they're core wiring). Use both, and be clear about which is which: natal aspects establish who they consistently are in this area, transit aspects establish what's specifically active about it right now.
- Open by naming the single most exact (smallest-orb) relevant TRANSIT aspect and what it means concretely for ${area} — not generic sign-trait description. State it in plain terms per the voice rules above, not as a technical measurement.
- Explicitly distinguish NOW from SOON in plain words: if an aspect is building, say what to watch for as it intensifies over the coming days; if it's already past its peak, say what that easing means moving forward.
- Do not describe personality traits of the person's Sun/Moon/Rising sign in the abstract (no "Leos are natural leaders" type sentences) — every sentence should trace back to one of the specific computed aspects given.
- If this chart's real house placements are given in the data, use them — this is what makes a reading actually personal instead of generic. A career reading should know whether this person's Sun is really in their 10th house or somewhere else entirely, and say so if it changes the picture (e.g. Sun in the 11th house makes career more about community/networks than solo achievement). Don't assume standard textbook house-sign correspondence when real data contradicts it.
- This reading is about the person in general — their patterns, tendencies, what's genuinely happening in their chart right now. Not a goal-tracking check-in.
- STRICT LIMIT: 200 words maximum, no exceptions. Budget your paragraphs — if you're covering multiple aspects, keep each one to 1-2 sentences rather than a full paragraph per aspect. A shorter complete reading is always better than a longer one that risks cutting off.
- Do NOT end the reading itself with an action/suggestion line — that goes in the separate action_ideas field instead, so don't duplicate it in prose.
- If NO relevant aspects are in the data, say so plainly and give the single most useful general observation available from what data does exist — do not fabricate an aspect to fill space.

Hard rules for the "action_ideas" field (this is the "what do I actually do" part — make it count):
- Exactly 2-3 items. Each one a genuinely different, concrete, specific action tied directly to an aspect you named in the reading — not generic advice that could apply to anyone.
- Each idea should be something they could actually do in the next few days, not an abstract mindset shift. "Send that email you've been sitting on" beats "embrace communication."
- Vary the ideas across the aspects covered where possible — don't give 3 variations on the same one action.
- Each idea: one sentence, under 20 words, plain everyday language, no astrology jargon. No hedging, no "maybe consider" — direct and doable, understandable at a glance.
- Never vague encouragement like "stay positive" or "trust the process" — these must be things a person could literally check off.

Output ONLY this JSON shape, no markdown fences, no extra text:
{
  "reading": "the prose reading as described above",
  "action_ideas": ["idea 1", "idea 2"]
}`;
}

function buildScenarioPrompt(area, scenario) {
  return `You are talking directly to this person like a perceptive friend who happens to know astrology well. They've described a SPECIFIC situation they want advice on — this is not a generic daily reading, answer THEIR actual situation directly. You'll also be given REAL, COMPUTED transit-to-natal aspect data (exact orbs, applying/separating trends from actual planetary positions) — use it as genuine grounding for the advice, not decoration bolted onto generic advice.

Their situation: "${scenario}"

${AREA_FOCUS[area]}

Voice:
- Second person, warm, conversational, contractions. Like a friend who actually knows your chart giving you real advice about something you just told them, not a formal reading.
- Direct. If the astrology suggests caution or a real blind spot relevant to their situation, say so — don't just tell them what's comforting.
- PLAIN LANGUAGE, ADHD-friendly: one idea per sentence, short sentences, no stacked clauses. Never use "orb," "transiting," "natal," "applying," or "separating" as standalone jargon — translate into plain words instead (e.g. "this is exact right now," "still building over the next few days," "already past its peak"). Name planets and the general idea of an aspect freely, just not the technical measurement language. A reader with zero astrology background should follow every sentence.

Hard rules for the "reading" field:
- Address their specific situation head-on in the first sentence — don't open with generic chart chatter before getting to what they asked.
- Use ONLY the aspects listed in the data to ground your advice. Never invent an aspect, degree, or placement not explicitly given. If an aspect genuinely bears on their situation, name it and explain the connection in plain terms; if none of the given aspects are relevant, say so honestly rather than forcing a connection.
- Explicitly note NOW vs SOON in plain words where relevant: something still building means timing matters for their decision; something already easing means that influence has passed its peak.
- STRICT LIMIT: 200 words maximum. A shorter complete answer beats a longer one that risks cutting off.
- Do NOT end with an action line in the prose — that goes in action_ideas.

Hard rules for the "action_ideas" field (this is the "what do I actually do" part):
- Exactly 2-3 items, specific to THEIR situation (not generic astrology advice) — genuinely different, doable in the next few days.
- Each idea: one sentence, under 20 words, plain everyday language, no hedging, no jargon.

Output ONLY this JSON shape, no markdown fences, no extra text:
{
  "reading": "the prose reading as described above",
  "action_ideas": ["idea 1", "idea 2"]
}`;
}

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

    const { area, profile, for_date, scenario } = req.body || {};
    const validAreas = Object.keys(AREA_FOCUS);
    if (!area || !validAreas.includes(area)) {
      return res.status(400).json({ error: `Missing or invalid 'area'. Must be one of: ${validAreas.join(", ")}` });
    }
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server" });
    }

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

      const housePlacements = parseHousePlacements(profile?.natal_chart_notes || "");
      const houseLines = Object.entries(housePlacements)
        .map(([body, house]) => `${body} in house ${house}`)
        .join(", ");
      const houseBlock = houseLines
        ? `\n\nThis chart's actual house placements (use these instead of assuming generic textbook house-sign correspondence — e.g. this person's Sun might not be in the 10th house at all):\n${houseLines}`
        : "";

      // Permanent natal-to-natal aspects (their own chart's core wiring) —
      // previously parsed nowhere despite being real data the user provided.
      // Filtered to whichever involve this area's key bodies, same
      // relevance logic as the transit aspects above.
      const natalAspects = parseNatalAspects(profile?.natal_chart_notes || "");
      const relevantNatalAspects = natalAspects.filter(
        (a) => keyBodies.includes(a.bodyA) || keyBodies.includes(a.bodyB)
      );
      const natalAspectLines = relevantNatalAspects.length
        ? relevantNatalAspects.map((a) => `Natal ${a.bodyA} ${a.aspect} ${a.bodyB}`).join("\n")
        : "";
      const natalAspectBlock = natalAspectLines
        ? `\n\nThis chart's own PERMANENT natal aspects relevant to ${area} (core wiring, not today's transits):\n${natalAspectLines}`
        : "";

      dataBlock = `Today's exact transiting positions: ${positionsLine}\n\nActive transit-to-natal aspects relevant to ${area} (real computed data, sorted tightest first):\n${aspectLines}${houseBlock}${natalAspectBlock}`;
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

    const systemPrompt = scenario?.trim() ? buildScenarioPrompt(area, scenario.trim()) : buildStandardPrompt(area);
    const userContent = dataBlock;

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 900,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    const finishReason = completion.choices?.[0]?.finish_reason;

    if (!raw) {
      console.error("Groq returned empty content for astrology reading. Full completion:", JSON.stringify(completion));
      return res.status(502).json({
        error: `The model returned an empty response (finish_reason: ${finishReason || "unknown"}). Try again.`,
      });
    }

    const parsed = extractJson(raw);
    if (!parsed?.reading) {
      console.error(`Astrology response not parseable JSON (finish_reason: ${finishReason}):`, raw.slice(0, 500));
      return res.status(502).json({
        error:
          finishReason === "length"
            ? "The reading was cut off before finishing (hit length limit). Try again."
            : "Couldn't parse the reading. Try again.",
      });
    }

    const actionIdeas = Array.isArray(parsed.action_ideas) ? parsed.action_ideas.filter(Boolean).slice(0, 3) : [];

    return res.status(200).json({
      area,
      reading: parsed.reading,
      action_ideas: actionIdeas,
      for_date: for_date || new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    const detail = err?.error?.message || err?.message || "Unknown server error";
    console.error("Astrology endpoint crashed:", err);
    return res.status(500).json({ error: `Reading failed: ${detail}` });
  }
}
