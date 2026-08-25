// .toISOString().slice(0,10) gives the UTC date, which is wrong for "today"
// bucketing whenever the user's local date differs from UTC's (i.e. most of
// the time for anyone not in a UTC+0-ish timezone). Use calendar-local parts
// instead everywhere "today" is computed for caching/display purposes.
export function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
