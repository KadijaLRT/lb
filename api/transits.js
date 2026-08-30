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

const PLANET_MEANING = {
  Sun: "core confidence and sense of self",
  Moon: "emotions and gut instincts",
  Mercury: "way of thinking and communicating",
  Venus: "sense of love, money, and values",
  Mars: "drive, motivation, and temper",
  Jupiter: "sense of growth, luck, and opportunity",
  Saturn: "discipline, responsibility, and limits",
  Uranus: "capacity for surprises and sudden change",
  Neptune: "dreams, intuition, and confusion",
  Pluto: "capacity for intensity and deep change",
};

const ASPECT_PLAIN = {
  conjunction: "is merging with",
  trine: "is working smoothly with",
  sextile: "is giving a gentle boost to",
  square: "is creating friction with",
  opposition: "is pulling against",
};

// Genuinely personal: states today's actual planetary positions, then
// compares them against this specific chart via the tightest real
// transit-to-natal aspects (same math as the Go Deeper readings) — an
// actual "today vs. your chart" comparison, not one isolated fact. Two
// people with the same Moon sign today will NOT see the same text unless
// their natal charts happen to produce the same aspects — vanishingly
// unlikely. Written in plain language on purpose — no "orb," "transiting,"
// "natal," or "applying/separating" jargon in the output, even though
// that's what's being computed under the hood.
function personalVibeFromAspects(natalLongitudes, placements, now) {
  const sunSign = placements.Sun.sign;
  const moonSign = placements.Moon.sign;
  const positionLine = `Sun's in ${sunSign}, Moon's in ${moonSign} today.`;

  const aspects = currentTransitAspects(natalLongitudes, now, 3);
  if (!aspects.length) {
    return `${positionLine} Nothing from today's sky is lining up tightly with your chart right now — a quieter day, astrologically.`;
  }

  // Up to 2 tightest real aspects, so the "vibe" reflects more than one
  // isolated data point — a real comparison, not a single fact.
  const top = aspects.slice(0, 2);
  const aspectPhrases = top.map((t) => {
    const meaning = PLANET_MEANING[t.natalBody] || t.natalBody;
    const verb = ASPECT_PLAIN[t.aspect] || "is affecting";
    const isBuilding = t.trend.startsWith("applying");
    const trendPhrase = isBuilding ? "still building over the next few days" : "already past its peak";
    return `${t.transitBody} ${verb} your ${meaning} (${trendPhrase})`;
  });

  return `${positionLine} ${aspectPhrases.join(", and ")}.`;
}

function genericVibeFallback(placements, natal, date, hasNotesButUnparseable) {
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
  // Distinguish the two failure modes so this is actually debuggable next
  // time, instead of one message covering both "nothing saved" and
  // "something's saved but couldn't be read."
  const reason = hasNotesButUnparseable
    ? "Your chart notes are saved but couldn't be read — check the format in Settings (the live preview there shows exactly what's detected)."
    : "Add your full natal chart in Settings for a reading built from your actual placements instead of this general one.";
  return `Moon in ${moonSign}: ${mood} (Sun's in ${sunSign} for the season. ${reason})`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { sun, moon, rising, natal_chart_notes, for_date } = req.body || {};
    const natal = { sun: sun || undefined, moon: moon || undefined, rising: rising || undefined };

    // Pinning to a fixed reference time (noon UTC) for the given calendar
    // day, rather than the literal live moment — planets move continuously,
    // so computing "the tightest aspects right now" fresh on every request
    // meant the vibe could genuinely change (sometimes substantially, not
    // just wording) between opening the app at 9:54 and again at 10:15 on
    // the SAME day. "Today's vibe" should be a stable daily snapshot, like
    // a weather forecast computed once for the day, not recalculated every
    // time you check it. Falls back to the live moment only if the client
    // didn't send a date (shouldn't normally happen).
    const now = for_date ? new Date(`${for_date}T12:00:00Z`) : new Date();
    const placements = currentPlacements(now);
    const element = ELEMENT_BY_SIGN[placements.Sun.sign];

    let vibe;
    let personalized = false;
    const natalLongitudes = parseNatalLongitudes(natal_chart_notes || "");
    if (Object.keys(natalLongitudes).length > 0) {
      vibe = personalVibeFromAspects(natalLongitudes, placements, now);
      personalized = true;
    }
    if (!vibe) {
      const hasNotesButUnparseable = !!(natal_chart_notes && natal_chart_notes.trim());
      vibe = genericVibeFallback(placements, natal, now, hasNotesButUnparseable);
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
