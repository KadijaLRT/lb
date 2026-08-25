const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

function findSignFor(notes, label) {
  const signPattern = SIGNS.join("|");
  // "<label> ... <Sign>" e.g. "Sun: Leo 13°54'" or "Ascendant Libra 2°28'"
  const reA = new RegExp(`\\b${label}\\b[^A-Za-z0-9]{0,6}(${signPattern})`, "i");
  // "<label> ... <deg> <Sign>" e.g. "Sun 13°54 Leo"
  const reB = new RegExp(`\\b${label}\\b[^A-Za-z0-9]{0,6}\\d{1,2}(?:[°º][\\d'\\s]*)?\\s+(${signPattern})`, "i");

  const match = notes.match(reA) || notes.match(reB);
  if (!match) return null;
  const found = match[1];
  // Normalize casing (e.g. "leo" -> "Leo")
  return SIGNS.find((s) => s.toLowerCase() === found.toLowerCase()) || null;
}

// Pulls Sun/Moon/Rising directly out of pasted or uploaded natal chart text.
// Tolerant of a few common formats; returns null for anything it can't find
// rather than guessing, so it never overwrites a real value with garbage.
export function extractSignsFromNotes(notes) {
  if (!notes || typeof notes !== "string") return {};
  const sun = findSignFor(notes, "Sun");
  const moon = findSignFor(notes, "Moon");
  // "Rising" is rare in raw chart data; "Ascendant" (or "ASC") is the
  // standard term for the same thing.
  const rising = findSignFor(notes, "Ascendant") || findSignFor(notes, "Rising") || findSignFor(notes, "ASC");

  const out = {};
  if (sun) out.sun_sign = sun;
  if (moon) out.moon_sign = moon;
  if (rising) out.rising_sign = rising;
  return out;
}
