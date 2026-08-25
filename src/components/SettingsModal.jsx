import { useState, useEffect } from "react";
import { X, Loader2, Image as ImageIcon } from "lucide-react";
import { extractSignsFromNotes } from "../lib/extractSigns.js";

const FIELDS = [
  { key: "name", label: "Name", type: "text" },
  { key: "pronoun", label: "Pronoun", type: "text" },
  { key: "birth_date", label: "Birth date", type: "date" },
  { key: "birth_time", label: "Birth time", type: "time" },
  { key: "birth_location", label: "Birth location", type: "text" },
  { key: "birth_lat", label: "Birth latitude (e.g. 18.0 for Kingston)", type: "number" },
  { key: "birth_lng", label: "Birth longitude (e.g. -76.8, west is negative)", type: "number" },
  { key: "birth_utc_offset", label: "Timezone at birth, UTC offset (e.g. -5)", type: "number" },
  { key: "weekly_budget", label: "Weekly budget ($)", type: "number" },
  { key: "core_goals", label: "Core goals / life vision (one per line)", type: "textarea" },
  {
    key: "natal_chart_notes",
    label: "Full natal chart (paste or upload — Sun/Moon/Rising are pulled from this automatically, no need to enter them separately)",
    type: "textarea",
  },
];

export default function SettingsModal({ open, onClose, profile, onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [parsingImages, setParsingImages] = useState(false);
  const [imageCount, setImageCount] = useState(0);
  const [detected, setDetected] = useState(null);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  if (!open) return null;

  async function handleScreenshotUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (files.length > 5) {
      setError("Max 5 screenshots at a time.");
      e.target.value = "";
      return;
    }
    setParsingImages(true);
    setImageCount(files.length);
    setError("");
    try {
      const images = await Promise.all(
        files.map(
          (file) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result); // full data: URL
              reader.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
              reader.readAsDataURL(file);
            })
        )
      );

      // Base64 inflates size by ~33%; server limit is 35mb. Fail fast with a
      // clear message instead of a slow upload that dies with a raw 413.
      const totalBytes = images.reduce((sum, dataUrl) => sum + dataUrl.length * 0.75, 0);
      if (totalBytes > 30 * 1024 * 1024) {
        throw new Error("Those screenshots are too large combined (over ~30MB). Try fewer at a time, or lower-resolution crops.");
      }
      const res = await fetch("/api/parse-natal-screenshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          res.ok ? "Server returned an unreadable response." : `Server error (${res.status}): ${raw.slice(0, 200) || "no details"}`
        );
      }
      if (!res.ok) throw new Error(data.error || "Screenshot parsing failed.");
      const combinedNotes = form.natal_chart_notes ? `${form.natal_chart_notes}\n\n${data.notes}` : data.notes;
      const derived = extractSignsFromNotes(combinedNotes);
      setForm((prev) => ({ ...prev, natal_chart_notes: combinedNotes, ...derived }));
      if (data.truncated) {
        setError(data.warning || "Extracted data may be cut off — check the notes field.");
      } else if (derived.sun_sign || derived.moon_sign || derived.rising_sign) {
        setDetected(derived);
      }
    } catch (err) {
      setError(err.message || "Couldn't parse those screenshots.");
    } finally {
      setParsingImages(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const patch = { ...form };
      delete patch.id;
      delete patch.created_at;
      // Sun/Moon/Rising fields were removed from this form — derive them
      // from the chart notes instead, so downstream features (astro card,
      // coach context, Go Deeper) still have sign data without redundant
      // manual entry. Only overwrites when something's actually found, so
      // it never nulls out a previously-good value on a vague notes edit.
      const derived = extractSignsFromNotes(patch.natal_chart_notes);
      Object.assign(patch, derived);
      // Empty strings on date/time/numeric columns make Postgres reject the
      // WHOLE update, not just that field — coerce blanks to null instead.
      const NUMERIC_FIELDS = ["weekly_budget", "birth_lat", "birth_lng", "birth_utc_offset"];
      Object.keys(patch).forEach((key) => {
        if (patch[key] === "") {
          patch[key] = null;
        } else if (NUMERIC_FIELDS.includes(key) && patch[key] != null) {
          patch[key] = Number(patch[key]);
        }
      });
      await onSave(patch);
      onClose();
    } catch (err) {
      console.error("Settings save failed:", err);
      setError(
        err?.message?.includes("column")
          ? "Save failed — your Supabase table is missing a column. Run the latest supabase/schema.sql migrations."
          : err?.message || "Save failed. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-cream/30 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-panel border border-line rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-cream">Your details</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.15em] text-muted">{f.label}</label>
              {f.key === "natal_chart_notes" && (
                <label className="self-start flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-line hover:border-clay cursor-pointer transition-colors mb-1">
                  {parsingImages ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                  {parsingImages ? `Reading ${imageCount} screenshot${imageCount > 1 ? "s" : ""}…` : "Upload screenshots instead (up to 5)"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleScreenshotUpload}
                    className="hidden"
                    disabled={parsingImages}
                  />
                </label>
              )}
              {f.key === "natal_chart_notes" && detected && (
                <p className="text-xs text-clay -mt-0.5 mb-1">
                  Detected: {[
                    detected.sun_sign && `Sun ${detected.sun_sign}`,
                    detected.moon_sign && `Moon ${detected.moon_sign}`,
                    detected.rising_sign && `Rising ${detected.rising_sign}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {f.type === "textarea" ? (
                <textarea
                  rows={f.key === "natal_chart_notes" ? 8 : 3}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-transparent border border-line rounded-lg p-2 focus:border-clay outline-none text-cream resize-none"
                />
              ) : (
                <input
                  type={f.type}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-transparent border-b border-line focus:border-clay outline-none text-cream py-1"
                />
              )}
            </div>
          ))}
          {error && <p className="text-sm text-fire">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full mt-2 py-2.5 rounded-xl bg-clay text-ink font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
