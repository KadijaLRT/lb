export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { birth_date, birth_time, birth_utc_offset, birth_lat } = req.body || {};
    if (!birth_date || birth_utc_offset === undefined || birth_utc_offset === null) {
      return res.status(400).json({
        error: "Need birth_date and birth_utc_offset at minimum. Add these in Settings first.",
      });
    }

    const time = birth_time || "12:00";
    const localISO = `${birth_date}T${time}:00`;
    const localDate = new Date(localISO);
    if (Number.isNaN(localDate.getTime())) {
      return res.status(400).json({ error: "Couldn't parse birth_date/birth_time." });
    }
    const birthUTC = new Date(localDate.getTime() - Number(birth_utc_offset) * 60 * 60 * 1000);

    let ephemeris;
    try {
      ephemeris = await import("./_ephemeris.js");
    } catch (err) {
      console.error("Ephemeris module failed to load:", err.message);
      return res.status(500).json({ error: `Ephemeris engine unavailable: ${err.message}` });
    }

    const lines = ephemeris.astrocartographyChart(birthUTC, birth_lat != null ? Number(birth_lat) : null);
    return res.status(200).json({
      generatedFromUTC: birthUTC.toISOString(),
      usedBirthTimeDefault: !birth_time,
      hasLatitude: birth_lat != null,
      lines,
      note: "MC/IC are exact meridians. ASC/DSC are computed only at your stored birth latitude (a single real point, not the full curve) — for a full rendered map, cross-check with a dedicated astrocartography tool.",
    });
  } catch (err) {
    console.error("Astrocartography endpoint crashed:", err);
    return res.status(500).json({ error: `Couldn't compute astrocartography lines: ${err.message || "unknown error"}` });
  }
}
