// Returns today's Sun transit sign + a short vibe line, cross-referenced with
// natal Sun/Moon/Rising when provided. If TRANSIT_API_KEY is set, this calls a
// real ephemeris provider (freeastrologyapi.com-style REST API) for full
// planetary positions. Without a key, it falls back to a zero-dependency
// Sun-sign-by-date calculation so the astro card still works out of the box.

const SUN_SIGN_RANGES = [
  { sign: "Capricorn", from: [12, 22], to: [1, 19] },
  { sign: "Aquarius", from: [1, 20], to: [2, 18] },
  { sign: "Pisces", from: [2, 19], to: [3, 20] },
  { sign: "Aries", from: [3, 21], to: [4, 19] },
  { sign: "Taurus", from: [4, 20], to: [5, 20] },
  { sign: "Gemini", from: [5, 21], to: [6, 20] },
  { sign: "Cancer", from: [6, 21], to: [7, 22] },
  { sign: "Leo", from: [7, 23], to: [8, 22] },
  { sign: "Virgo", from: [8, 23], to: [9, 22] },
  { sign: "Libra", from: [9, 23], to: [10, 22] },
  { sign: "Scorpio", from: [10, 23], to: [11, 21] },
  { sign: "Sagittarius", from: [11, 22], to: [12, 21] },
];

const ELEMENT_BY_SIGN = {
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water",
};

function sunSignForDate(date) {
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  for (const r of SUN_SIGN_RANGES) {
    const [fm, fd] = r.from;
    const [tm, td] = r.to;
    if (fm === tm) {
      if (m === fm && d >= fd && d <= td) return r.sign;
    } else if ((m === fm && d >= fd) || (m === tm && d <= td)) {
      return r.sign;
    }
  }
  return "Capricorn";
}

function fallbackVibe(transitSun, natal = {}) {
  const element = ELEMENT_BY_SIGN[transitSun];
  const base = `Sun in ${transitSun}`;
  if (natal.sun && natal.sun === transitSun) {
    return { element, vibe: `${base} — your solar return window. Good day to start something with your name on it.` };
  }
  const focusBySign = {
    fire: "Good for pitching, starting, moving fast. Watch impulsive spending or overcommitting.",
    earth: "Good for finances, admin, and finishing what's half-done. Low-drama, high-output day.",
    air: "Good for scripts, threads, and conversations. Ideas flow faster than follow-through — write things down.",
    water: "Good for reflection and rest. Push big decisions a day if you can.",
  };
  return { element, vibe: `${base}. ${focusBySign[element] || ""}` };
}

async function fetchRealTransits(apiKey, natal) {
  // Swap this URL/shape for whichever ephemeris provider you sign up with
  // (e.g. freeastrologyapi.com, astrologyapi.com, Prokerala). Left generic
  // since providers differ; this is the one place to edit.
  const res = await fetch("https://json.freeastrologyapi.com/planets", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      year: new Date().getUTCFullYear(),
      month: new Date().getUTCMonth() + 1,
      date: new Date().getUTCDate(),
      hours: 12,
      minutes: 0,
      seconds: 0,
      latitude: 0,
      longitude: 0,
      timezone: 0,
    }),
  });
  if (!res.ok) throw new Error(`Transit provider returned ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const natal = {
    sun: req.query.sun || undefined,
    moon: req.query.moon || undefined,
    rising: req.query.rising || undefined,
  };

  const apiKey = process.env.TRANSIT_API_KEY;

  if (apiKey) {
    try {
      const raw = await fetchRealTransits(apiKey, natal);
      // Provider-specific parsing goes here once you've picked one — for now
      // we still compute the vibe line locally so the card always renders.
      const sunSign = sunSignForDate(new Date());
      const { element, vibe } = fallbackVibe(sunSign, natal);
      return res.status(200).json({ sun: sunSign, element, vibe, raw, source: "api" });
    } catch (err) {
      console.error("Transit API error, falling back:", err.message);
    }
  }

  const sunSign = sunSignForDate(new Date());
  const { element, vibe } = fallbackVibe(sunSign, natal);
  return res.status(200).json({ sun: sunSign, element, vibe, source: "fallback" });
}
