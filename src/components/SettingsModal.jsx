import { useState, useEffect } from "react";
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { extractSignsFromNotes } from "../lib/extractSigns.js";
import { parseNatalLongitudes, parseHousePlacements, parseNatalAspects } from "../../api/_ephemeris.js";

const FIELDS = [
  { key: "name", label: "Name", type: "text", section: "About you" },
  { key: "pronoun", label: "Pronoun", type: "text", section: "About you" },
  {
    key: "content_voice_sample",
    label: "Paste a few things you'd actually text or post (optional) — the coach and everything else in the app will talk more like you actually talk, not a generic assistant",
    type: "textarea",
    section: "About you",
  },
  { key: "birth_date", label: "Birth date", type: "date", section: "Birth data" },
  { key: "birth_time", label: "Birth time", type: "time", section: "Birth data" },
  { key: "birth_location", label: "Birth location", type: "text", section: "Birth data" },
  { key: "birth_utc_offset", label: "Timezone at birth, UTC offset (e.g. -5)", type: "number", section: "Birth data" },
  { key: "weekly_budget", label: "Weekly budget ($)", type: "number", section: "Finance" },
  { key: "core_goals", label: "Core goals / life vision (one per line)", type: "textarea", section: "Goals" },
  {
    key: "natal_chart_notes",
    label: "Full natal chart (paste it — Sun/Moon/Rising are pulled from this automatically, no need to enter them separately)",
    type: "textarea",
    section: "Astrology",
  },
];

function ChartParsePreview({ notes }) {
  if (!notes || !notes.trim()) {
    return <p className="text-xs text-muted italic mt-1">Nothing pasted yet — this is what powers every reading in the app.</p>;
  }

  const planets = parseNatalLongitudes(notes);
  const houses = parseHousePlacements(notes);
  const aspects = parseNatalAspects(notes);
  const planetCount = Object.keys(planets).length;

  if (planetCount === 0) {
    return (
      <p className="text-xs text-fire flex items-center gap-1.5 mt-1">
        <AlertCircle size={12} className="shrink-0" />
        Couldn't read any planets from this text — the readings will fall back to generic. Check the format (e.g. "Sun: Leo 13°54'").
      </p>
    );
  }

  return (
    <p className="text-xs text-clay flex items-center gap-1.5 mt-1">
      <CheckCircle2 size={12} className="shrink-0" />
      Reading this correctly: {planetCount} of 10 planets, {Object.keys(houses).length} house placements, {aspects.length} aspects detected.
    </p>
  );
}

export default function SettingsModal({ open, onClose, profile, onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  if (!open) return null;

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
      const NUMERIC_FIELDS = ["weekly_budget", "birth_utc_offset"];
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
          {FIELDS.map((f, i) => (
            <div key={f.key} className="flex flex-col gap-1">
              {f.section !== FIELDS[i - 1]?.section && (
                <p className="text-[10px] uppercase tracking-[0.25em] text-clay pt-2 first:pt-0">{f.section}</p>
              )}
              <label className="text-xs uppercase tracking-[0.15em] text-muted">{f.label}</label>
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
              {f.key === "natal_chart_notes" && <ChartParsePreview notes={form.natal_chart_notes} />}
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
