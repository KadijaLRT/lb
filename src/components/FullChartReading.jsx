import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Loader2, Lightbulb, Clock } from "lucide-react";
import { getFullChartReading, saveFullChartReading } from "../lib/db.js";
import ChatFollowUp from "./ChatFollowUp.jsx";

export default function FullChartReading({ profile }) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(undefined); // undefined = not loaded, null = none yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !profile?.id || reading !== undefined) return;
    getFullChartReading(profile.id)
      .then((row) => setReading(row?.content || null))
      .catch(() => setReading(null));
  }, [open, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
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
        throw new Error(res.ok ? "Unreadable response." : `Server error (${res.status}): ${raw.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(data.error || "Couldn't generate the reading.");
      setReading(data);
      if (profile?.id) {
        saveFullChartReading(profile.id, data).catch((e) => console.error(e));
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-cream">
          <Sparkles size={14} className="text-clay" />
          Full chart reading
        </span>
        {reading?.generated_at && (
          <span className="text-xs text-muted">Generated {new Date(reading.generated_at).toLocaleDateString()}</span>
        )}
      </button>

      {open && (
        <div className="border-t border-line p-4 flex flex-col gap-4">
          {reading === undefined && <p className="text-sm text-muted">Loading…</p>}

          {reading === null && !loading && (
            <p className="text-sm text-muted italic">
              A full synthesis of your chart — who you are, real computed dates for your Saturn/Jupiter life cycles, what's active now, and what's forming over the coming months. Needs your full natal chart in Settings (not just Sun/Moon/Rising).
            </p>
          )}

          {reading && (
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-xs uppercase tracking-[0.2em] text-clay">Who you are</span>
                <p className="text-cream/90 leading-relaxed whitespace-pre-wrap mt-1">{reading.identity_summary}</p>
              </div>

              {reading.life_cycles?.length > 0 && (
                <div>
                  <span className="text-xs uppercase tracking-[0.2em] text-clay flex items-center gap-1.5">
                    <Clock size={12} />
                    Life cycles — real computed dates
                  </span>
                  <div className="flex flex-col gap-1 mt-1.5 mb-2">
                    {reading.life_cycles.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className={c.status === "past" ? "text-muted" : "text-cream"}>{c.label}</span>
                        <span className={`px-2 py-0.5 rounded-full border border-line ${c.status === "past" ? "text-muted" : "text-clay"}`}>
                          {c.date} {c.status === "past" ? "· past" : "· upcoming"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-cream/90 leading-relaxed whitespace-pre-wrap">{reading.life_cycles_narrative}</p>
                </div>
              )}

              <div>
                <span className="text-xs uppercase tracking-[0.2em] text-clay">Right now</span>
                <p className="text-cream/90 leading-relaxed whitespace-pre-wrap mt-1">{reading.current_chapter}</p>
              </div>

              <div>
                <span className="text-xs uppercase tracking-[0.2em] text-clay">Coming months</span>
                <p className="text-cream/90 leading-relaxed whitespace-pre-wrap mt-1">{reading.upcoming_months}</p>
              </div>

              {reading.action_ideas?.length > 0 && (
                <div className="pt-2 border-t border-line">
                  <span className="text-xs uppercase tracking-[0.2em] text-clay flex items-center gap-1.5">
                    <Lightbulb size={12} />
                    Try this
                  </span>
                  <div className="flex flex-col gap-1.5 mt-1.5">
                    {reading.action_ideas.map((idea, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-cream/90">
                        <span className="text-clay mt-1.5 w-1 h-1 rounded-full bg-clay shrink-0" />
                        {idea}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <ChatFollowUp
                profile={profile}
                priorReading={[reading.identity_summary, reading.current_chapter, reading.upcoming_months]
                  .filter(Boolean)
                  .join(" ")}
                contextKey="full_chart"
              />
            </div>
          )}

          {error && <p className="text-sm text-fire">{error}</p>}

          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="self-start px-3 py-1.5 rounded-full border border-line hover:border-clay text-sm flex items-center gap-2 disabled:opacity-40"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {loading ? "Reading your chart…" : reading ? "Regenerate" : "Generate my full reading"}
          </button>
        </div>
      )}
    </div>
  );
}
