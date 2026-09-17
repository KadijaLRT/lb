import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, RefreshCw, Sparkles, Star } from "lucide-react";
import { getFullChartReading, saveFullChartReading } from "../lib/db.js";

export default function FullChartReading({ profile }) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(undefined); // undefined = not loaded yet, null = loaded but none exists
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingCached, setLoadingCached] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open || !profile?.id || reading !== undefined) return;
    setLoadingCached(true);
    getFullChartReading(profile.id)
      .then((row) => {
        if (!mountedRef.current) return;
        setReading(row?.content || null);
        setGeneratedAt(row?.generated_at || null);
      })
      .catch((err) => {
        console.error("Couldn't load saved chart reading:", err);
        if (mountedRef.current) setReading(null);
      })
      .finally(() => {
        if (mountedRef.current) setLoadingCached(false);
      });
  }, [open, profile?.id, reading]);

  async function generate() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/full-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(res.ok ? "Server returned an unreadable response." : `Server error (${res.status})`);
      }
      if (!res.ok) throw new Error(data.error || `Reading failed (${res.status}).`);

      if (!mountedRef.current) return;
      setReading(data);
      setGeneratedAt(new Date().toISOString());

      if (profile?.id) {
        saveFullChartReading(profile.id, data).catch((err) => console.error("Couldn't save chart reading:", err));
      }
    } catch (err) {
      if (mountedRef.current) setError(err.message || "Something went wrong.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  const hasEnoughData = !!profile?.natal_chart_notes?.trim();

  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-cream">
          <Star size={14} className="text-clay" />
          Full chart reading
        </span>
        <ChevronDown size={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-line p-4 flex flex-col gap-4">
          {!hasEnoughData && (
            <p className="text-sm text-muted italic">
              Paste your full natal chart in Settings first — this reads every planet, house, and aspect you've got in there.
            </p>
          )}

          {hasEnoughData && loadingCached && <p className="text-sm text-muted">Checking for a saved reading…</p>}

          {hasEnoughData && !loadingCached && reading && (
            <div className="flex flex-col gap-4">
              {generatedAt && (
                <span className="text-xs text-muted">Generated {new Date(generatedAt).toLocaleDateString()}</span>
              )}

              <p className="text-cream/90 leading-relaxed whitespace-pre-wrap">{reading.overview}</p>

              {reading.strengths?.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs uppercase tracking-[0.2em] text-clay flex items-center gap-1.5">
                    <Sparkles size={12} />
                    Strengths
                  </span>
                  {reading.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-cream/90">
                      <span className="text-clay mt-1.5 w-1 h-1 rounded-full bg-clay shrink-0" />
                      {s}
                    </div>
                  ))}
                </div>
              )}

              {reading.growth_edges?.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-line">
                  <span className="text-xs uppercase tracking-[0.2em] text-earth">Growth edges</span>
                  {reading.growth_edges.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-cream/90">
                      <span className="text-earth mt-1.5 w-1 h-1 rounded-full bg-earth shrink-0" />
                      {s}
                    </div>
                  ))}
                </div>
              )}

              {reading.vedic_notes && (
                <div className="pt-2 border-t border-line flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted">Vedic layer</span>
                  <p className="text-sm text-cream/90 leading-relaxed">{reading.vedic_notes}</p>
                </div>
              )}
            </div>
          )}

          {hasEnoughData && !loadingCached && !reading && !loading && (
            <p className="text-sm text-muted italic">No reading generated yet.</p>
          )}

          {error && <p className="text-sm text-fire">{error}</p>}

          {hasEnoughData && (
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="self-start px-3 py-1.5 rounded-full border border-line hover:border-clay text-sm flex items-center gap-2 disabled:opacity-40"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {loading ? "Reading your chart…" : reading ? "Regenerate" : "Generate my full chart reading"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
