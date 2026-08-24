import { useEffect, useState } from "react";

const ELEMENT_COLOR = {
  fire: "bg-fire",
  earth: "bg-earth",
  air: "bg-air",
  water: "bg-water",
};

export default function AstroSnapshot({ sun, moon, rising }) {
  const [transit, setTransit] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (sun) params.set("sun", sun);
    if (moon) params.set("moon", moon);
    if (rising) params.set("rising", rising);
    fetch(`/api/transits?${params.toString()}`)
      .then((r) => r.json())
      .then(setTransit)
      .catch(() => setTransit(null));
  }, [sun, moon, rising]);

  const element = transit?.element || "water";
  const vibe = transit?.vibe || "Set your birth data to unlock daily transits.";

  return (
    <div className="border border-line rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">Today's vibe</span>
        <span className={`w-2.5 h-2.5 rounded-full ${ELEMENT_COLOR[element] || "bg-muted"}`} />
      </div>
      <p className="font-display text-lg text-cream leading-snug">{vibe}</p>
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
