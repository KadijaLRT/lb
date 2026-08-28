// Today's real transiting placements via astronomy-engine — no external API
// or key needed.
//
// Personalization: when full natal chart data is available, "today's vibe"
// is now built from a real computed transit-to-natal aspect (same math as
// the Go Deeper readings) — genuinely about this person's chart, not a
// generic per-element phrase that anyone with the same Moon sign that day
// would also see. The generic Moon-element phrasing only applies as a
// fallback when there's no natal chart data to compute real aspects from.

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

// Deterministic per-day pick — only used in the no-natal-data fallback.
function pickVariant(list, date) {
  const dayIndex = Math.floor(date.getTime() / 86400000);
  return list[dayIndex % list.length];
}

const ASPECT_MEANING = {
  conjunction: "amplifying",
  trine: "flowing easily with",
  sextile: "opening a door with",
  square: "creating friction with",
  opposition: "pulling against",
};

// Genuinely personal: built from the single tightest real transit-to-natal
// aspect right now, using this person's actual chart. Two people with the
// same Moon sign today will NOT see the same text unless their natal
// charts happen to produce the same tightest aspect — vanishingly unlikely.
function personalVibeFromAspects(natalLongitudes, now) {
  const aspects = currentTransitAspects(natalLongitudes, now, 3);
  if (!aspects.length) return null;
  const tightest = aspects[0];
  const verb = ASPECT_MEANING[tightest.aspect] || "aspecting";
  return `Transiting ${tightest.transitBody} is ${verb} your natal ${tightest.natalBody} right now (orb ${tightest.orb}°, ${tightest.trend}) — that's what's actually active in your chart today.`;
}

function genericVibeFallback(placements, natal, date) {
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
  return `Moon in ${moonSign}: ${mood} (Sun's in ${sunSign} for the season. Add your full natal chart in Settings for a reading built from your actual placements instead of this general one.)`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { sun, moon, rising, natal_chart_notes } = req.body || {};
    const natal = { sun: sun || undefined, moon: moon || undefined, rising: rising || undefined };

    const now = new Date();
    const placements = currentPlacements(now);
    const element = ELEMENT_BY_SIGN[placements.Sun.sign];

    let vibe;
    let personalized = false;
    const natalLongitudes = parseNatalLongitudes(natal_chart_notes || "");
    if (Object.keys(natalLongitudes).length > 0) {
      const personal = personalVibeFromAspects(natalLongitudes, now);
      if (personal) {
        vibe = personal;
        personalized = true;
      }
    }
    if (!vibe) {
      vibe = genericVibeFallback(placements, natal, now);
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
