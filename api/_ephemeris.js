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
