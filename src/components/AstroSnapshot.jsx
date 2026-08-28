import { useEffect, useState } from "react";

const ELEMENT_COLOR = {
  fire: "bg-fire",
  earth: "bg-earth",
  air: "bg-air",
  water: "bg-water",
};

export default function AstroSnapshot({ sun, moon, rising, natalChartNotes }) {
  const [transit, setTransit] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    fetch("/api/transits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sun, moon, rising, natal_chart_notes: natalChartNotes }),
    })
      .then(async (r) => {
        const raw = await r.text();
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(r.ok ? "Unreadable response from server." : `Server error (${r.status})`);
        }
        if (!r.ok) throw new Error((data && data.error) || `Server error (${r.status}): ${raw.slice(0, 300) || "empty response"}`);
        return data;
      })
      .then(setTransit)
      .catch((err) => {
        setTransit(null);
        setError(err.message || "Couldn't load today's transits.");
      });
  }, [sun, moon, rising, natalChartNotes]);

  const element = transit?.element || "water";
  const vibe = transit?.vibe || (error ? null : sun || moon || rising ? "Loading…" : "Set your birth data to unlock daily transits.");

  return (
    <div className="border border-line rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">Today's vibe</span>
        <span className={`w-2.5 h-2.5 rounded-full ${ELEMENT_COLOR[element] || "bg-muted"}`} />
      </div>
      <p className="font-display text-lg text-cream leading-snug">{vibe}</p>
      {error && <p className="text-xs text-fire">{error}</p>}
      {(sun || moon || rising) && (
        <div className="flex gap-4 text-xs text-muted pt-2 border-t border-line">
          {sun && <span>☉ {sun}</span>}
          {moon && <span>☽ {moon}</span>}
          {rising && <span>ASC {rising}</span>}
        </div>
      )}
    </div>
  );
}
