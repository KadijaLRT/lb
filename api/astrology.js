import Groq from "groq-sdk";
import {
  currentPlacements,
  parseNatalLongitudes,
  parseHousePlacements,
  parseNatalAspects,
  currentTransitAspects,
  signForLongitude,
  toSidereal,
  siderealSignForLongitude,
  getNakshatra,
  wholeSignHouse,
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
  return `Write like a popular horoscope/astrology account posting on social media — confident, punchy, a little dramatic, talking directly about what's actually going on. Not a therapist, not translating everything into soft psychological language. Real astrologers on social media say "Venus retrograde in Scorpio" and "your rising sign" right out loud, with total confidence — they don't tiptoe around the terms or explain them away. Match that register.

${AREA_FOCUS[area]}

How to write this:
1. Look at the real computed data below (Western tropical, Vedic sidereal, nakshatras, houses, real aspects) and find the single most specific, most interesting thing in there for ${area} right now.
2. State it directly and with confidence, the way an astrology account states things — declarative, a little bit "here's what's actually happening," not hedged with "might" and "could." Use the real astrological terms (planet names, signs, retrograde, houses, nakshatras) plainly and directly — don't soften them into vague plain-English paraphrases. Someone who follows astrology content should recognize this as the real thing, not a watered-down version.
3. It's fine — good, even — to fold a direct piece of advice or a "watch out for X" / "this is your sign to Y" right into the read itself, the way real horoscope content does, instead of always holding it back for a separate list.
4. Keep it grounded in the ONE most interesting real thing — don't try to cover every data point. Punchy and specific beats comprehensive.

Guardrails:
- Everything has to trace back to the real data given — never invent a placement, aspect, sign, retrograde, or nakshatra that isn't actually there. Confidence in tone does not mean license to make things up; state real things confidently, don't invent things to sound more dramatic.
- If the Western/Vedic comparison is genuinely the most interesting real thing, use it; if it isn't, ignore it — most readings shouldn't force it in.
- Casual, direct, a little lowercase-energy even if not literally lowercase — contractions, real talk, not a formal report. Some personality and edge is good.
- Never a repeated flowery metaphor ("gentle hand," "soft kiss," "bright boost") — that's the OPPOSITE of what you're going for; those sound like a greeting card, not an astrology account.
- Length: as long as it needs to be to say the one true thing well — no padding, but don't artificially cut it short either.
- If there's genuinely nothing interesting in the data, say that plainly rather than manufacturing something.

Hard rules for the "action_ideas" field (the "what do I actually do" part):
- Exactly 2-3 items. Each one concrete and specific, tied to the actual thing you just said — not generic advice.
- Doable in the next few days. "Send that email you've been sitting on" beats "embrace communication."
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
  return `Someone just told you something going on in their life and wants your take. You know their chart well and you're texting them back — not writing them a report. This is the "get advice" part of the app, so it should feel more like an actual conversation than any other reading in here: casual, reactive, warm, like you actually have something to say about what they just shared.

Their situation: "${scenario}"

${AREA_FOCUS[area]}

Voice — this is the most important part:
- React like a person would. If what they shared is exciting, sound a little excited. If it's stressful, acknowledge that first. Don't skip straight to analysis — respond to THEM before you respond to the chart.
- Write it the way you'd actually text a friend back: contractions, casual phrasing, maybe a quick aside or a rhetorical question. Not clinical, not a structured breakdown.
- Weave the astrology into what you're saying naturally, like a thought that occurred to you mid-conversation — not "here is the relevant aspect" but more like "and honestly, [planet]'s doing [thing] right now, so..."
- Still direct — a good friend tells you the truth, doesn't just hype you up. If there's a real caution or blind spot, say it, but say it the way a friend would, not a warning label.
- PLAIN LANGUAGE, no jargon left unexplained. Never bare "orb," "transiting," "natal," "applying," "separating" — translate into plain words instead (e.g. "this is exact right now," "still building over the next few days," "already past its peak").
- Pick the ONE real thing that actually matters most for what they're describing and build the whole response around it, like it's the one thing you wanted to point out — not a checklist. You'll have a bunch of real data available (Western, Vedic, aspects) — that's raw material for finding the one true thing, not a set of systems to synthesize together. If the Western/Vedic comparison happens to be the most interesting thing, use it; otherwise ignore it completely.
- Avoid repeated flowery metaphors ("gentle hand," "soft kiss," "bright boost") — that's stiff, not conversational.

Hard rules for the "reading" field:
- Use ONLY the aspects given to ground what you say. Never invent an aspect, degree, or placement not explicitly given. If none of them genuinely fit the situation, say that honestly instead of forcing one in.
- If timing matters for their decision, say so the way a friend would — "this is still building, so there's no rush" or "honestly, the intensity's already past its peak" — not a formal applying/separating breakdown.
- STRICT LIMIT: 130 words. Short and natural beats comprehensive — this is a text back, not an essay.
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
      // Cut hard, from 6 down to 3 — handing the model 6+ real aspects and
      // saying "use these" reliably produces a mechanical one-sentence-per-
      // aspect list, no matter how much the prompt says "be concise."
      // Fewer facts in means a naturally shorter, less repetitive response.
      const chosen = (relevant.length ? relevant : allAspects).slice(0, 3);

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

      // Permanent natal-to-natal aspects (their own chart's core wiring).
      // Sorted tightest-orb-first (when orb data is available) and capped
      // at 2 — same reasoning as above, a handful of real facts beats a
      // long list the model feels obligated to work through.
      const natalAspects = parseNatalAspects(profile?.natal_chart_notes || "");
      const relevantNatalAspects = natalAspects
        .filter((a) => keyBodies.includes(a.bodyA) || keyBodies.includes(a.bodyB))
        .sort((a, b) => (a.orb ?? 99) - (b.orb ?? 99))
        .slice(0, 2);
      const natalAspectLines = relevantNatalAspects.length
        ? relevantNatalAspects.map((a) => `Natal ${a.bodyA} ${a.aspect} ${a.bodyB}`).join("\n")
        : "";
      const natalAspectBlock = natalAspectLines
        ? `\n\nThis chart's own PERMANENT natal aspects relevant to ${area} (core wiring, not today's transits):\n${natalAspectLines}`
        : "";

      // Vedic (sidereal) layer alongside the Western (tropical) sign for
      // each body — a genuine side-by-side, not just Vedic data in
      // isolation. Real aspects (above) are identical in both systems
      // (subtracting the same ayanamsa from two positions cancels out in
      // their angular difference), so this adds the piece that genuinely
      // differs between the two: which SIGN each planet falls in, plus
      // nakshatra and whole-sign house for the Vedic side.
      const ascendantTropicalLon = natalLongitudes["Ascendant"];
      const ascendantSiderealLon = ascendantTropicalLon != null ? toSidereal(ascendantTropicalLon, now) : null;

      const comparisonEntries = keyBodies
        .filter((b) => natalLongitudes[b] != null)
        .map((b) => {
          const tropicalLon = natalLongitudes[b];
          const western = signForLongitude(tropicalLon);
          const siderealLon = toSidereal(tropicalLon, now);
          const { sign: siderealSign, degreeInSign: siderealDegree } = siderealSignForLongitude(tropicalLon, now);
          const { name: nakshatra, pada } = getNakshatra(siderealLon);
          const house = ascendantSiderealLon != null ? wholeSignHouse(siderealLon, ascendantSiderealLon) : null;
          return {
            body: b,
            westernSign: western.sign,
            westernDegree: western.degreeInSign,
            siderealSign,
            siderealDegree,
            nakshatra,
            pada,
            house,
            signChanged: western.sign !== siderealSign,
          };
        });

      const comparisonLines = comparisonEntries
        .map(
          (e) =>
            `${e.body}: Western tropical ${e.westernDegree.toFixed(1)}° ${e.westernSign}  vs.  Vedic sidereal ${e.siderealDegree.toFixed(1)}° ${e.siderealSign} (${e.nakshatra} nakshatra, pada ${e.pada}${e.house ? `, whole-sign house ${e.house}` : ""})${e.signChanged ? "  ← different sign in each system" : "  (same sign in both systems)"}`
        )
        .join("\n");

      const vedicBlock = comparisonLines
        ? `\n\nWestern vs. Vedic side-by-side for this area — both real, both computed from the same actual planetary positions, only the zodiac reference point differs (Vedic uses the Lahiri ayanamsa correction):\n${comparisonLines}${ascendantSiderealLon == null ? "\n(No Ascendant found in the chart notes, so whole-sign Vedic houses can't be computed — sign and nakshatra comparisons above are still real and usable.)" : ""}`
        : "";

      dataBlock = `Today's exact transiting positions: ${positionsLine}\n\nActive transit-to-natal aspects relevant to ${area} (real computed data, sorted tightest first):\n${aspectLines}${houseBlock}${natalAspectBlock}${vedicBlock}`;
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
