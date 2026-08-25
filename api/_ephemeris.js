import * as Astronomy from "astronomy-engine";

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

export function signForLongitude(lonDeg) {
  const norm = ((lonDeg % 360) + 360) % 360;
  const idx = Math.floor(norm / 30);
  return { sign: SIGNS[idx], degreeInSign: +(norm - idx * 30).toFixed(2) };
}

// Geocentric apparent ecliptic longitude, tropical zodiac.
// IMPORTANT: Astronomy.EclipticLongitude() computes HELIOCENTRIC longitude,
// which is wrong for zodiac-sign purposes (we want "as seen from Earth") and
// throws outright when called on the Sun (a body has no heliocentric
// position relative to itself). Use the correct geocentric path instead:
// SunPosition() for the Sun, EclipticGeoMoon() for the Moon, and
// GeoVector() + Ecliptic() for everything else.
export function eclipticLongitude(bodyName, date) {
  if (bodyName === "Sun") {
    return Astronomy.SunPosition(date).elon;
  }
  if (bodyName === "Moon") {
    return Astronomy.EclipticGeoMoon(date).lon;
  }
  const body = Astronomy.Body[bodyName];
  const vec = Astronomy.GeoVector(body, date, true);
  return Astronomy.Ecliptic(vec).elon;
}

export function currentPlacements(date = new Date()) {
  const out = {};
  for (const b of BODIES) {
    out[b] = signForLongitude(eclipticLongitude(b, date));
  }
  return out;
}

// Geocentric-of-date right ascension (hours) and declination (degrees).
// Observer is placed at lat 0 / lon 0 / sea level as a lightweight stand-in
// for a true geocentric frame — introduces a small parallax error (largest
// for the Moon, negligible for outer planets), acceptable for astrocartography
// and daily-transit purposes here.
export function equatorialOfDate(bodyName, date) {
  const body = Astronomy.Body[bodyName];
  const observer = new Astronomy.Observer(0, 0, 0);
  const eq = Astronomy.Equator(body, date, observer, true, true);
  return { ra: eq.ra, dec: eq.dec };
}

// Greenwich Apparent Sidereal Time, in degrees.
export function gmstDegrees(date) {
  return Astronomy.SiderealTime(date) * 15;
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
      const H = (Math.acos(cosH) * 180) / Math.PI; // degrees
      const lstAsc = raDeg - H; // rising: east of meridian
      const lstDsc = raDeg + H; // setting: west of meridian
      asc = normalizeLon(lstAsc - gmst);
      dsc = normalizeLon(lstDsc - gmst);
    }
    // cosH outside [-1, 1] means the body never rises/sets at that latitude
    // (circumpolar or never-visible) — asc/dsc stay null.
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
