// Today's real transiting placements via astronomy-engine — no external API
// or key needed. Cross-references natal Sun/Moon/Rising when provided for a
// slightly more personal vibe line.

function vibeFor(placements, ELEMENT_BY_SIGN, natal = {}) {
  const sunSign = placements.Sun.sign;
  const moonSign = placements.Moon.sign;
  const element = ELEMENT_BY_SIGN[sunSign];

  if (natal.sun && natal.sun === sunSign) {
    return `Sun in ${sunSign} — your solar return window. Good day to start something with your name on it.`;
  }

  const focusBySign = {
    fire: "Good for pitching, starting, moving fast. Watch impulsive spending or overcommitting.",
    earth: "Good for finances, admin, and finishing what's half-done. Low-drama, high-output day.",
    air: "Good for scripts, threads, and conversations. Ideas flow faster than follow-through — write things down.",
    water: "Good for reflection and rest. Push big decisions a day if you can.",
  };

  const moonNote = natal.moon
    ? ` Moon's in ${moonSign} today${moonSign === natal.moon ? " — same as your natal Moon, feelings run close to the surface." : "."}`
    : "";

  return `Sun in ${sunSign}. ${focusBySign[element] || ""}${moonNote}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const natal = {
      sun: req.query.sun || undefined,
      moon: req.query.moon || undefined,
      rising: req.query.rising || undefined,
    };

    let ephemeris;
    try {
      ephemeris = await import("./_ephemeris.js");
    } catch (err) {
      console.error("Ephemeris module failed to load:", err.message);
      return res.status(500).json({ error: `Ephemeris engine unavailable: ${err.message}` });
    }

    const placements = ephemeris.currentPlacements(new Date());
    const element = ephemeris.ELEMENT_BY_SIGN[placements.Sun.sign];
    const vibe = vibeFor(placements, ephemeris.ELEMENT_BY_SIGN, natal);
    return res.status(200).json({
      sun: placements.Sun.sign,
      element,
      vibe,
      placements,
      source: "ephemeris",
    });
  } catch (err) {
    console.error("Transits endpoint crashed:", err);
    return res.status(500).json({ error: `Couldn't compute today's transits: ${err.message || "unknown error"}` });
  }
}
