// Today's real transiting placements via astronomy-engine — no external API
// or key needed.
//
// Full rebuild: the personalized vibe used to be built by string-templating
// planet names into fixed sentence shapes ("X is doing Y with your Z").
// That's why it kept feeling mechanical and repetitive no matter how many
// times the templates were patched — concatenated strings can't vary tone
// or avoid sounding like a mad-lib. Now it's written by the same
// natural-language generation the rest of the app already uses (Go Deeper,
// the coach), grounded in ONE real computed fact (the single tightest
// transit-to-natal aspect) instead of stacking multiple planet mentions
// into one sentence.

import Groq from "groq-sdk";
import { currentPlacements, ELEMENT_BY_SIGN, parseNatalLongitudes, currentTransitAspects } from "./_ephemeris.js";

const MOOD_BY_ELEMENT = {
  fire: [
    "energy runs hot today — good for pitching, starting, moving fast. Watch impulsive spending or overcommitting.",
    "restless, quick-to-act energy. Great for kicking something off, less great for anything that needs patience.",
    "a spark-something-new kind of day. Good momentum for bold moves, easy to overcommit if you're not careful.",
  ],
  earth: [
    "grounded, practical mood — good for finances, admin, and finishing what's half-done. Low-drama, high-output day.",
    "steady energy, not flashy. Good for routine tasks and follow-through rather than big new starts.",
    "a build-something-real day. Good for money matters and anything that needs consistency, not sparks.",
  ],
  air: [
    "heady, talkative energy — good for scripts, threads, conversations. Ideas move faster than follow-through, write things down.",
    "a lot of mental motion today. Good for brainstorming and connecting with people, harder to sit still and finish.",
    "quick-thinking, social mood. Good day for conversations that matter, watch for scattered focus.",
  ],
  water: [
    "feelings run close to the surface — good for reflection and rest. Push big decisions a day if you can.",
    "an intuitive, sensitive mood. Good for checking in with people you care about, not a great day to force logic.",
    "a slower, feeling-forward day. Good for rest and honesty with yourself, less good for high-pressure decisions.",
  ],
};

function pickVariant(list, date) {
  const dayIndex = Math.floor(date.getTime() / 86400000);
  return list[dayIndex % list.length];
}

// No-chart-data fallback stays deterministic JS — there's no real
// personalization happening in this path anyway, so an LLM call would just
// add latency/cost for no benefit. The complaint was about the templated
// PERSONALIZED text; this generic path was never the issue.
function genericVibeFallback(placements, natal, date, reason) {
  const sunSign = placements.Sun.sign;
  const moonSign = placements.Moon.sign;
  const moonElement = ELEMENT_BY_SIGN[moonSign];

  if (natal.sun && natal.sun === sunSign) {
    return `Sun in ${sunSign} — your solar return window. Good day to start something with your name on it.`;
  }
  if (natal.moon && natal.moon === moonSign) {
    return `Moon in ${moonSign} today — same as your natal Moon, feelings run close to the surface, more you than usual.`;
  }

  const moods = MOOD_BY_ELEMENT[moonElement] || [];
  const mood = pickVariant(moods, date) || "";
  // Three genuinely different situations that were previously conflated
  // into one message — a Groq outage was being misreported as a chart
  // formatting problem, which sends you chasing the wrong fix.
  const reasonText = {
    no_notes: "Add your full natal chart in Settings for a reading built from your actual placements instead of this general one.",
    unparseable: "Your chart notes are saved but couldn't be read — check the format in Settings (the live preview there shows exactly what's detected).",
    generation_failed: "Your chart read fine, but the personalized reading couldn't be generated right now — try again shortly.",
  }[reason];
  return `Moon in ${moonSign}: ${mood} (Sun's in ${sunSign} for the season. ${reasonText})`;
}

const VIBE_SYSTEM_PROMPT = `You write a single short "today's astrological vibe" line for someone, grounded in ONE real computed fact about their chart. Not a full reading — a quick, warm, natural-sounding line, like a friend texting "hey, heads up" energy.

Hard rules:
- ONE to two short sentences MAX. Under 35 words total.
- Ground it in the ONE real fact given — don't invent anything, don't add other planets or aspects not mentioned.
- Do NOT mechanically state raw positions as a checklist ("Sun is in X, Moon is in Y") — that's exactly the repetitive, mad-lib-sounding pattern to avoid. Weave the real fact into one natural, flowing thought instead.
- Plain everyday language, no astrology jargon left unexplained — no bare "orb," "transiting," "natal," "applying," "separating."
- Vary your sentence structure and word choice naturally — don't default to the same "X is [verb]-ing your Y" shape every time, write it the way a person actually would.
- Warm, direct, a little personality — not clinical, not fortune-teller vague.
- Include the practical "so what" — what this is actually good or bad for today, in a few words, not a separate paragraph.

Output ONLY the line itself. No quotes, no preamble, no explanation.`;

async function generatePersonalVibe(natalLongitudes, placements, now) {
  const aspects = currentTransitAspects(natalLongitudes, now, 3);
  if (!aspects.length) {
    return "Nothing from today's sky is lining up tightly with your chart right now — a quieter day, astrologically.";
  }

  const tightest = aspects[0];
  const isBuilding = tightest.trend.startsWith("applying");
  const factLine = `Today, transiting ${tightest.transitBody} is making a real ${tightest.aspect} to this person's natal ${tightest.natalBody} (this is ${
    isBuilding ? "still building/getting stronger over the next few days" : "already past its peak, easing off"
  }).`;

  if (!process.env.GROQ_API_KEY) {
    // No key configured — fail up to the caller's generic fallback rather
    // than crash; this keeps the endpoint usable even mid-setup.
    return null;
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    reasoning_effort: "low",
    messages: [
      { role: "system", content: VIBE_SYSTEM_PROMPT },
      { role: "user", content: factLine },
    ],
    temperature: 0.9,
    max_tokens: 150,
  });

  let line = completion.choices?.[0]?.message?.content?.trim() || "";
  if (!line) return null;

  if (completion.choices?.[0]?.finish_reason === "length") {
    const lastSentenceEnd = Math.max(line.lastIndexOf("."), line.lastIndexOf("!"), line.lastIndexOf("?"));
    if (lastSentenceEnd > -1) line = line.slice(0, lastSentenceEnd + 1);
  }
  return line;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { sun, moon, rising, natal_chart_notes, for_date } = req.body || {};
    const natal = { sun: sun || undefined, moon: moon || undefined, rising: rising || undefined };

    // Pinned to noon UTC of the given date when for_date is sent (stable
    // daily snapshot — used by Blueprint's AstroSnapshot); falls through to
    // the live moment when omitted (used by Action Center's live banner).
    const now = for_date ? new Date(`${for_date}T12:00:00Z`) : new Date();
    const placements = currentPlacements(now);
    const element = ELEMENT_BY_SIGN[placements.Sun.sign];

    let vibe = null;
    let personalized = false;
    let failureReason = "no_notes";
    const natalLongitudes = parseNatalLongitudes(natal_chart_notes || "");
    const hasNotes = !!(natal_chart_notes && natal_chart_notes.trim());

    if (Object.keys(natalLongitudes).length > 0) {
      try {
        vibe = await generatePersonalVibe(natalLongitudes, placements, now);
        if (vibe) personalized = true;
        else failureReason = "generation_failed";
      } catch (err) {
        console.error("Vibe generation failed, falling back:", err?.message || err);
        vibe = null;
        failureReason = "generation_failed";
      }
    } else if (hasNotes) {
      failureReason = "unparseable";
    }

    if (!vibe) {
      vibe = genericVibeFallback(placements, natal, now, failureReason);
    }

    return res.status(200).json({
      sun: placements.Sun.sign,
      moon: placements.Moon.sign,
      element,
      vibe,
      personalized,
      placements,
      source: "ephemeris",
    });
  } catch (err) {
    console.error("Transits endpoint crashed:", err);
    return res.status(500).json({ error: `Couldn't compute today's transits: ${err.message || "unknown error"}` });
  }
}
