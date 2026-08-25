import { useState, useEffect } from "react";
import { X, Loader2, Image as ImageIcon } from "lucide-react";

const FIELDS = [
  { key: "name", label: "Name", type: "text" },
  { key: "pronoun", label: "Pronoun", type: "text" },
  { key: "birth_date", label: "Birth date", type: "date" },
  { key: "birth_time", label: "Birth time", type: "time" },
  { key: "birth_location", label: "Birth location", type: "text" },
  { key: "birth_lat", label: "Birth latitude (e.g. 18.0 for Kingston)", type: "number" },
  { key: "birth_lng", label: "Birth longitude (e.g. -76.8, west is negative)", type: "number" },
  { key: "birth_utc_offset", label: "Timezone at birth, UTC offset (e.g. -5)", type: "number" },
  { key: "sun_sign", label: "Sun sign", type: "text" },
  { key: "moon_sign", label: "Moon sign", type: "text" },
  { key: "rising_sign", label: "Rising sign", type: "text" },
  { key: "weekly_budget", label: "Weekly budget ($)", type: "number" },
  { key: "core_goals", label: "Core goals / life vision", type: "textarea" },
  {
    key: "natal_chart_notes",
    label: "Full natal chart (paste placements, houses, aspects — powers deeper readings below)",
    type: "textarea",
  },
];

export default function SettingsModal({ open, onClose, profile, onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [parsingImages, setParsingImages] = useState(false);
  const [imageCount, setImageCount] = useState(0);

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
      const res = await fetch("/api/parse-natal-screenshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Screenshot parsing failed.");
      setForm((prev) => ({
        ...prev,
        natal_chart_notes: prev.natal_chart_notes
          ? `${prev.natal_chart_notes}\n\n${data.notes}`
          : data.notes,
      }));
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
