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
- DO NOT mechanically work through every aspect given, one sentence each, in a list-like pattern ("X is doing this to your Y. Also, A is doing that to your B. Meanwhile, C is..."). That reads like a form letter, not a friend talking. Pick the ONE aspect that matters most for this and build the reading around it — mention a second only if it genuinely adds something different, never just because it was in the data.
- DO NOT reach for a cute, repeated metaphor for every aspect ("gentle hand," "soft kiss," "bright boost," "warm embrace" — this kind of flowery astrology-brochure language, used more than once, is exactly the pattern to avoid). Say what's actually happening in plain, direct words instead of dressing each one up the same poetic way.

Hard rules for the "reading" field:
- Use ONLY the aspects listed in the data — both the today's transit aspects AND this chart's own permanent natal aspects, whichever are given. Never invent an aspect, degree, or placement not explicitly given. You do NOT need to use every aspect given — the data has already been trimmed to the most relevant few; pick the single most significant one (smallest orb, most exact) to actually build the reading around.
- You'll be given TWO kinds of aspects: transit-to-natal (today's temporary activation — these change day to day) and natal-to-natal (permanent aspects between this person's own planets — these never change, they're core wiring). If you use both, connect them into ONE cohesive point, not two separate mini-reports stapled together.
- Open by naming the single most exact (smallest-orb) relevant TRANSIT aspect and what it means concretely for ${area} — not generic sign-trait description. State it in plain terms per the voice rules above, not as a technical measurement.
- Explicitly distinguish NOW from SOON in plain words: if an aspect is building, say what to watch for as it intensifies over the coming days; if it's already past its peak, say what that easing means moving forward.
- Do not describe personality traits of the person's Sun/Moon/Rising sign in the abstract (no "Leos are natural leaders" type sentences) — every sentence should trace back to one of the specific computed aspects given.
- If this chart's real house placements are given in the data, use them — this is what makes a reading actually personal instead of generic. A career reading should know whether this person's Sun is really in their 10th house or somewhere else entirely, and say so if it changes the picture (e.g. Sun in the 11th house makes career more about community/networks than solo achievement). Don't assume standard textbook house-sign correspondence when real data contradicts it.
- This reading is about the person in general — their patterns, tendencies, what's genuinely happening in their chart right now. Not a goal-tracking check-in.
- STRICT LIMIT: 130 words maximum, no exceptions. This is meant to feel like one focused thought from a friend, not a report covering everything at once.
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
  return `Someone just told you something going on in their life and wants your take. You know their chart well and you're texting them back — not writing them a report. This is the "get advice" part of the app, so it should feel more like an actual conversation than any other reading in here: casual, reactive, warm, like you actually have something to say about what they just shared.

Their situation: "${scenario}"

${AREA_FOCUS[area]}

Voice — this is the most important part:
- React like a person would. If what they shared is exciting, sound a little excited. If it's stressful, acknowledge that first. Don't skip straight to analysis — respond to THEM before you respond to the chart.
- Write it the way you'd actually text a friend back: contractions, casual phrasing, maybe a quick aside or a rhetorical question. Not clinical, not a structured breakdown.
- Weave the astrology into what you're saying naturally, like a thought that occurred to you mid-conversation — not "here is the relevant aspect" but more like "and honestly, [planet]'s doing [thing] right now, so..."
- Still direct — a good friend tells you the truth, doesn't just hype you up. If there's a real caution or blind spot, say it, but say it the way a friend would, not a warning label.
- PLAIN LANGUAGE, no jargon left unexplained. Never bare "orb," "transiting," "natal," "applying," "separating" — translate into plain words instead (e.g. "this is exact right now," "still building over the next few days," "already past its peak").
- Pick the ONE real aspect that actually matters most for what they're describing and build the whole response around it, like it's the one thing you wanted to point out — not a checklist.
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
