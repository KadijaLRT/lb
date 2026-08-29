// Self-contained, zero-dependency ephemeris.
//
// Previously used the astronomy-engine npm package, which repeatedly failed
// to bundle/import correctly in Vercel's serverless Node runtime (ESM/CJS
// interop issues, "Unexpected token 'export'", silent crashes at
// module-load time). Rather than keep chasing bundler behavior, this
// replaces it with the classic "low precision formulae for planetary
// positions" method (Paul Schlyter, stjarnhimlen.se/comp/tutorial.html) —
// pure JS math, no external package, nothing that can fail to load.
//
// Accuracy: well under 1° for Sun/Moon, roughly 0.5-1° for the outer
// planets over recent decades. More than sufficient for zodiac-sign-level
// (30°-wide) astrology use and reasonable for approximate astrocartography
// angles. Not observatory-grade — that's not the goal here.

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

export const ELEMENT_BY_SIGN = {
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water",
};

export const BODIES = [
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
];

// Lilith and the Nodes aren't simple two-body orbits (Lilith is the Moon's
// orbital apogee, the Nodes are where its orbital plane crosses the
// ecliptic) — no real transit-computation formula for them here, so they
// stay OUT of BODIES (which drives actual ephemeris math). But their natal
// positions are still real data the user provides, and it was being
// silently dropped everywhere — this list is for PARSING their chart text
// only, never for computing where they are today.
const EXTRA_NATAL_POINTS = ["Lilith", "North Node", "South Node", "Fortune"];
const NATAL_POINTS = [...BODIES, ...EXTRA_NATAL_POINTS];

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// Orbital elements at epoch (2000 Jan 0.0 UT) with per-day rates of change.
// Source: Paul Schlyter's classic tutorial (public domain formulation,
// widely used in planetarium/astrology software for exactly this purpose).
const ELEMENTS = {
  Sun:     { N0: 0,        Nd: 0,           i0: 0,       id: 0,           w0: 282.9404,  wd: 4.70935e-5,  a0: 1.0,      ad: 0,          e0: 0.016709,  ed: -1.151e-9,  M0: 356.0470,  Md: 0.9856002585 },
  Moon:    { N0: 125.1228, Nd: -0.0529538083, i0: 5.1454, id: 0,           w0: 318.0634,  wd: 0.1643573223, a0: 60.2666,  ad: 0,          e0: 0.054900,  ed: 0,          M0: 115.3654,  Md: 13.0649929509 },
  Mercury: { N0: 48.3313,  Nd: 3.24587e-5,  i0: 7.0047,  id: 5.00e-8,     w0: 29.1241,   wd: 1.01444e-5,  a0: 0.387098, ad: 0,          e0: 0.205635,  ed: 5.59e-10,   M0: 168.6562,  Md: 4.0923344368 },
  Venus:   { N0: 76.6799,  Nd: 2.46590e-5,  i0: 3.3946,  id: 2.75e-8,     w0: 54.8910,   wd: 1.38374e-5,  a0: 0.723330, ad: 0,          e0: 0.006773,  ed: -1.302e-9,  M0: 48.0052,   Md: 1.6021302244 },
  Mars:    { N0: 49.5574,  Nd: 2.11081e-5,  i0: 1.8497,  id: -1.78e-8,    w0: 286.5016,  wd: 2.92961e-5,  a0: 1.523688, ad: 0,          e0: 0.093405,  ed: 2.516e-9,   M0: 18.6021,   Md: 0.5240207766 },
  Jupiter: { N0: 100.4542, Nd: 2.76854e-5,  i0: 1.3030,  id: -1.557e-7,   w0: 273.8777,  wd: 1.64505e-5,  a0: 5.20256,  ad: 0,          e0: 0.048498,  ed: 4.469e-9,   M0: 19.8950,   Md: 0.0830853001 },
  Saturn:  { N0: 113.6634, Nd: 2.38980e-5,  i0: 2.4886,  id: -1.081e-7,   w0: 339.3939,  wd: 2.97661e-5,  a0: 9.55475,  ad: 0,          e0: 0.055546,  ed: -9.499e-9,  M0: 316.9670,  Md: 0.0334442282 },
  Uranus:  { N0: 74.0005,  Nd: 1.3978e-5,   i0: 0.7733,  id: 1.9e-8,      w0: 96.6612,   wd: 3.0565e-5,   a0: 19.18171, ad: -1.55e-8,   e0: 0.047318,  ed: 7.45e-9,    M0: 142.5905,  Md: 0.011725806 },
  Neptune: { N0: 131.7806, Nd: 3.0173e-5,   i0: 1.7700,  id: -2.55e-7,    w0: 272.8461,  wd: -6.027e-6,   a0: 30.05826, ad: 3.313e-8,   e0: 0.008606,  ed: 2.15e-9,    M0: 260.2471,  Md: 0.005995147 },
  // Pluto's classical elements aren't part of Schlyter's core planet set
  // (its orbit isn't well-modeled by simple two-body Kepler over long
  // spans); these are approximate mean elements near J2000, fine for
  // sign-level accuracy for years around the present given its ~248-year
  // orbit moves it less than half a degree per month.
  Pluto:   { N0: 110.30,   Nd: 0,           i0: 17.16,   id: 0,           w0: 113.76,    wd: 0,           a0: 39.482,   ad: 0,          e0: 0.2488,    ed: 0,          M0: 14.53,     Md: 0.0039688 },
};

export function signForLongitude(lonDeg) {
  const norm = ((lonDeg % 360) + 360) % 360;
  const idx = Math.floor(norm / 30);
  return { sign: SIGNS[idx], degreeInSign: +(norm - idx * 30).toFixed(2) };
}

function normDeg(x) {
  const m = x % 360;
  return m < 0 ? m + 360 : m;
}

function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// "d" in Schlyter's convention: days since 2000 Jan 0.0 UT.
function daysSinceEpoch(date) {
  return julianDate(date) - 2451543.5;
}

function solveKepler(Mdeg, e) {
  const M = Mdeg * DEG;
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let n = 0; n < 8; n++) {
    const delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-9) break;
  }
  return E; // radians
}

// Heliocentric-orbit rectangular ecliptic coordinates (AU), for any body
// using its own orbital elements. For the Sun (N=0, i=0), this directly
// gives the Sun's *geocentric* position (the Sun's "orbit" IS Earth's orbit
// mirrored) — no separate Earth calculation needed, per Schlyter's method.
function orbitRect(body, d) {
  const el = ELEMENTS[body];
  const N = normDeg(el.N0 + el.Nd * d) * DEG;
  const i = normDeg(el.i0 + el.id * d) * DEG;
  const w = normDeg(el.w0 + el.wd * d) * DEG;
  const a = el.a0 + el.ad * d;
  const e = el.e0 + el.ed * d;
  const M = normDeg(el.M0 + el.Md * d);

  const E = solveKepler(M, e);
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);

  const x = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i));
  const y = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i));
  const z = r * (Math.sin(v + w) * Math.sin(i));
  return { x, y, z };
}

function geocentricRect(body, d) {
  if (body === "Sun") {
    return orbitRect("Sun", d); // already geocentric, see note above
  }
  if (body === "Moon") {
    return orbitRect("Moon", d); // Moon's elements are Earth-centered already
  }
  const helio = orbitRect(body, d);
  const sun = orbitRect("Sun", d);
  return { x: helio.x + sun.x, y: helio.y + sun.y, z: helio.z };
}

export function eclipticLonLat(body, date) {
  const d = daysSinceEpoch(date);
  const { x, y, z } = geocentricRect(body, d);
  const lon = normDeg(Math.atan2(y, x) * RAD);
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD;
  return { lon, lat };
}

export function eclipticLongitude(body, date) {
  return eclipticLonLat(body, date).lon;
}

export function currentPlacements(date = new Date()) {
  const out = {};
  for (const b of BODIES) {
    out[b] = signForLongitude(eclipticLongitude(b, date));
  }
  return out;
}

export function formatDegree(lonDeg) {
  const { sign, degreeInSign } = signForLongitude(lonDeg);
  const whole = Math.floor(degreeInSign);
  const min = Math.round((degreeInSign - whole) * 60);
  return `${whole}°${min.toString().padStart(2, "0")} ${sign}`;
}

// Parse a natal chart notes blob for planet placements, tolerant of a few
// common formats users paste in ("Sun: Leo 13°54'", "Sun 13°54 Leo (XI)",
// "Sun 13.9 Leo"). Returns { Sun: longitudeDeg, Moon: ..., ... } for
// whatever it can find — missing bodies are simply absent, not guessed.
export function parseNatalLongitudes(notes) {
  if (!notes || typeof notes !== "string") return {};
  const signPattern = SIGNS.join("|");
  const out = {};
  for (const body of NATAL_POINTS) {
    const reA = new RegExp(
      `\\b${body}\\b[^A-Za-z0-9]{0,6}(${signPattern})\\s+(\\d{1,2})(?:[°º]\\s*(\\d{1,2}))?`,
      "i"
    );
    const reB = new RegExp(
      `\\b${body}\\b[^A-Za-z0-9]{0,6}(\\d{1,2})(?:[°º]\\s*(\\d{1,2})|\\.(\\d{1,2}))?\\s+(${signPattern})`,
      "i"
    );

    let match = notes.match(reA);
    let sign, deg, min;
    if (match) {
      [, sign, deg, min] = match;
    } else {
      match = notes.match(reB);
      if (match) {
        const [, d, m, decimal, s] = match;
        sign = s;
        deg = d;
        min = decimal ? Math.round(Number(`0.${decimal}`) * 60) : m;
      }
    }
    if (!sign) continue;

    const signIdx = SIGNS.findIndex((s) => s.toLowerCase() === sign.toLowerCase());
    if (signIdx === -1) continue;
    const degreeInSign = Number(deg) + (min ? Number(min) / 60 : 0);
    out[body] = normDeg(signIdx * 30 + degreeInSign);
  }
  return out;
}

const ROMAN_TO_NUM = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };

// Parses which house each planet occupies — this was the gap: real chart
// notes often contain house placements ("Sun in XI" or "Sun: Leo 13°54 (XI)")
// but nothing was ever extracting them, so readings only ever referenced
// generic textbook house-sign correspondence (e.g. "the 10th house means
// career") instead of where THIS chart's planets actually sit.
export function parseHousePlacements(notes) {
  if (!notes || typeof notes !== "string") return {};
  const out = {};
  for (const body of NATAL_POINTS) {
    // "<body> in <roman>" — e.g. "Sun in XI"
    let match = notes.match(new RegExp(`\\b${body}\\b\\s+in\\s+([IVXLCDM]+)\\b`, "i"));
    if (!match) {
      // "<body> ... (<roman>)" on the same line — e.g. "Sun: Leo 13°54' (XI)"
      match = notes.match(new RegExp(`\\b${body}\\b[^\\n]*?\\(([IVXLCDM]+)\\)`, "i"));
    }
    if (!match) continue;
    const roman = match[1].toUpperCase();
    if (ROMAN_TO_NUM[roman]) out[body] = ROMAN_TO_NUM[roman];
  }
  return out;
}

const ASPECTS = [
  { name: "conjunction", angle: 0, orb: 6 },
  { name: "sextile", angle: 60, orb: 4 },
  { name: "square", angle: 90, orb: 6 },
  { name: "trine", angle: 120, orb: 6 },
  { name: "opposition", angle: 180, orb: 6 },
];

function angularSeparation(a, b) {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

// Real transit-to-natal aspects: for each transiting body, check angular
// separation from each natal body against the 5 major aspects. Uses a
// second (near-future) transit snapshot to determine whether the aspect is
// tightening (applying) or loosening (separating) — genuine trend data,
// computed from real planetary motion, not a guess.
export function currentTransitAspects(natalLongitudes, transitDate = new Date(), lookaheadDays = 5) {
  const future = new Date(transitDate.getTime() + lookaheadDays * 86400000);
  const results = [];

  for (const transitBody of BODIES) {
    const nowLon = eclipticLongitude(transitBody, transitDate);
    const laterLon = eclipticLongitude(transitBody, future);

    for (const [natalBody, natalLon] of Object.entries(natalLongitudes)) {
      const sepNow = angularSeparation(nowLon, natalLon);
      const sepLater = angularSeparation(laterLon, natalLon);

      for (const asp of ASPECTS) {
        const orbNow = Math.abs(sepNow - asp.angle);
        if (orbNow <= asp.orb) {
          const orbLater = Math.abs(sepLater - asp.angle);
          results.push({
            transitBody,
            natalBody,
            aspect: asp.name,
            orb: +orbNow.toFixed(2),
            trend: orbLater < orbNow ? "applying (tightening over the next few days)" : "separating (loosening over the next few days)",
          });
        }
      }
    }
  }

  return results.sort((a, b) => a.orb - b.orb);
}

function obliquityOfEcliptic(d) {
  return 23.4393 - 3.563e-7 * d; // degrees
}

// Geocentric-of-date right ascension (hours) and declination (degrees).
export function equatorialOfDate(body, date) {
  const d = daysSinceEpoch(date);
  const { lon, lat } = eclipticLonLat(body, date);
  const eps = obliquityOfEcliptic(d) * DEG;
  const lonR = lon * DEG;
  const latR = lat * DEG;

  const x = Math.cos(lonR) * Math.cos(latR);
  const y = Math.cos(eps) * Math.sin(lonR) * Math.cos(latR) - Math.sin(eps) * Math.sin(latR);
  const z = Math.sin(eps) * Math.sin(lonR) * Math.cos(latR) + Math.cos(eps) * Math.sin(latR);

  const ra = normDeg(Math.atan2(y, x) * RAD) / 15; // hours
  const dec = Math.asin(Math.max(-1, Math.min(1, z))) * RAD;
  return { ra, dec };
}

// Greenwich (Mean) Sidereal Time, in degrees. Standard Meeus formula.
export function gmstDegrees(date) {
  const jd = julianDate(date);
  const T = (jd - 2451545.0) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000;
  return normDeg(gmst);
}

function normalizeLon(deg) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return +d.toFixed(2);
}

// Astrocartography angles for one body at the moment of birth:
// MC/IC longitudes (single meridians), and ASC/DSC longitude specifically at
// the given birth latitude (a real computed point, not a full rendered curve).
export function angularLinesForBody(bodyName, birthDateUTC, birthLat) {
  const { ra, dec } = equatorialOfDate(bodyName, birthDateUTC);
  const gmst = gmstDegrees(birthDateUTC);
  const raDeg = ra * 15;

  const mc = normalizeLon(raDeg - gmst);
  const ic = normalizeLon(mc + 180);

  let asc = null;
  let dsc = null;
  if (typeof birthLat === "number" && !Number.isNaN(birthLat)) {
    const phi = (birthLat * Math.PI) / 180;
    const delta = (dec * Math.PI) / 180;
    const cosH = -Math.tan(phi) * Math.tan(delta);
    if (cosH >= -1 && cosH <= 1) {
      const H = (Math.acos(cosH) * 180) / Math.PI;
      const lstAsc = raDeg - H;
      const lstDsc = raDeg + H;
      asc = normalizeLon(lstAsc - gmst);
      dsc = normalizeLon(lstDsc - gmst);
    }
  }

  return { mc, ic, asc, dsc };
}

export function astrocartographyChart(birthDateUTC, birthLat) {
  const out = {};
  for (const b of BODIES) {
    out[b] = angularLinesForBody(b, birthDateUTC, birthLat);
  }
  return out;
}

// Real "return" dates — the actual moment a planet's transiting longitude
// crosses back over the exact natal degree it occupied at birth (Saturn
// return, Jupiter return, etc.). This is a genuine, computable astronomical
// event, not a guess: numerical root-finding on the signed angular
// difference between transiting and natal longitude, refined by linear
// interpolation once a sign-crossing is found. A planet can cross the same
// degree up to 3 times near a return (direct, retrograde, direct again) —
// this returns the FIRST crossing found in the search window, which is
// sufficient for a "this is roughly when it happens" milestone marker.
function findReturnDate(body, natalLongitude, searchStart, searchEnd, stepDays = 3) {
  let prevDiff = null;
  let prevDate = null;
  let current = new Date(searchStart);
  const end = new Date(searchEnd);

  while (current <= end) {
    const lon = eclipticLongitude(body, current);
    let diff = ((lon - natalLongitude + 540) % 360) - 180; // signed, in [-180, 180]

    if (prevDiff !== null && Math.sign(diff) !== Math.sign(prevDiff) && Math.abs(diff - prevDiff) < 180) {
      const frac = Math.abs(prevDiff) / (Math.abs(prevDiff) + Math.abs(diff));
      return new Date(prevDate.getTime() + frac * (current.getTime() - prevDate.getTime()));
    }
    prevDiff = diff;
    prevDate = new Date(current);
    current = new Date(current.getTime() + stepDays * 86400000);
  }
  return null;
}

const ORBITAL_PERIOD_YEARS = { Saturn: 29.457, Jupiter: 11.862 };
const YEAR_MS = 365.25 * 86400000;

// For each of Saturn/Jupiter (the two classical "life cycle" markers in
// real astrology — Saturn ~29.5yr, Jupiter ~11.9yr), find the most recent
// PAST return and the next UPCOMING one relative to today. Real dates,
// computed from this specific chart — not a generic "your Saturn return is
// around 29" estimate.
export function computeLifeCycles(natalLongitudes, birthDate, referenceDate = new Date()) {
  const cycles = [];

  for (const body of ["Saturn", "Jupiter"]) {
    const natalLon = natalLongitudes[body];
    if (natalLon == null) continue;
    const periodYears = ORBITAL_PERIOD_YEARS[body];

    const found = [];
    for (let n = 1; n * periodYears < 100; n++) {
      const center = new Date(birthDate.getTime() + n * periodYears * YEAR_MS);
      const windowStart = new Date(center.getTime() - 200 * 86400000);
      const windowEnd = new Date(center.getTime() + 200 * 86400000);
      const date = findReturnDate(body, natalLon, windowStart, windowEnd);
      if (date) found.push({ n, date });
    }

    const past = found.filter((f) => f.date <= referenceDate).sort((a, b) => b.date - a.date)[0];
    const upcoming = found.filter((f) => f.date > referenceDate).sort((a, b) => a.date - b.date)[0];

    if (past) {
      cycles.push({
        planet: body,
        label: `${body} return #${past.n}`,
        date: past.date.toISOString().slice(0, 10),
        status: "past",
      });
    }
    if (upcoming) {
      cycles.push({
        planet: body,
        label: `${body} return #${upcoming.n}`,
        date: upcoming.date.toISOString().slice(0, 10),
        status: "upcoming",
      });
    }
  }

  return cycles.sort((a, b) => new Date(a.date) - new Date(b.date));
}

const ASPECT_WORDS = ["Conjunction", "Opposition", "Square", "Trine", "Sextile"];

// Parses the person's own NATAL aspect list — e.g. "Sun Conjunction Moon
// (43), Venus Trine Uranus (16)" — permanent aspects between their own
// planets, distinct from today's transit-to-natal aspects. This describes
// core, unchanging personality wiring and was previously never parsed or
// used anywhere, even though it's exactly the kind of data a real natal
// chart reading should be grounded in.
export function parseNatalAspects(notes) {
  if (!notes || typeof notes !== "string") return [];
  const pattern = new RegExp(
    `([A-Za-z][A-Za-z ]*?)\\s+(${ASPECT_WORDS.join("|")})\\s+([A-Za-z][A-Za-z ]*?)\\s*\\(([+-]?\\d+)\\)`,
    "gi"
  );
  const results = [];
  let match;
  while ((match = pattern.exec(notes)) !== null) {
    results.push({
      bodyA: match[1].trim(),
      aspect: match[2].toLowerCase(),
      bodyB: match[3].trim(),
      value: Number(match[4]),
    });
  }
  return results;
}
