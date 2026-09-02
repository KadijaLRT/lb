import { useEffect, useState } from "react";
import { PauseCircle, Loader2 } from "lucide-react";

export default function ImpulsePause({ context }) {
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const [what, setWhat] = useState("");
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [open, seconds]);

  function start() {
    setOpen(true);
    setSeconds(30);
    setReflection("");
    setWhat("");
    setError("");
  }

  async function askCoach() {
    if (!what.trim()) return;
    setLoading(true);
    setError("");
    setReflection("");
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `30-second impulse pause check-in. I'm about to buy: ${what}. Give me one direct, non-judgmental question to sit with, not a lecture.`,
          context,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Coach request failed (${res.status})`);
      if (!data.reply) throw new Error("Got an empty response back.");
      setReflection(data.reply);
    } catch (err) {
      setError(err.message || "Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={start}
        className="text-xs flex items-center gap-1.5 text-muted hover:text-cream transition-colors"
      >
        <PauseCircle size={14} />
        30s Impulse Check
      </button>
    );
  }

  return (
    <div className="border border-line rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">Pause</span>
        <span className="font-display text-2xl text-clay">{seconds}s</span>
      </div>
      <input
        value={what}
        onChange={(e) => setWhat(e.target.value)}
        placeholder="What are you about to buy?"
        className="w-full bg-transparent border-b border-line focus:border-clay outline-none text-cream placeholder:text-muted/60 py-1"
      />
      <button
        type="button"
        onClick={askCoach}
        disabled={loading || !what.trim()}
        className="self-start px-3 py-1.5 rounded-full border border-line hover:border-clay text-sm disabled:opacity-40 flex items-center gap-2"
      >
        {loading && <Loader2 size={12} className="animate-spin" />}
        Ask the coach
      </button>
      {error && <p className="text-sm text-fire">{error}</p>}
      {reflection && <p className="text-sm text-cream/90">{reflection}</p>}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="self-end text-xs text-muted hover:text-cream"
      >
        Close
      </button>
    </div>
  );
}
