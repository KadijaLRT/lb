import { useState } from "react";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";

const FORMAT_COLOR = {
  listicle: "text-air",
  confession: "text-water",
  "hot-take": "text-fire",
  tutorial: "text-earth",
  "pain-point": "text-clay",
};

export default function IdeaGenerator({ profile, onUseIdea }) {
  const [open, setOpen] = useState(false);
  const [seedTopic, setSeedTopic] = useState("");
  const [ideas, setIdeas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/content-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, seedTopic: seedTopic.trim() || undefined }),
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(res.ok ? "Unreadable response." : `Server error (${res.status}): ${raw.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(data.error || "Idea generation failed.");
      setIdeas(data.ideas);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-line rounded-2xl p-4 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted"
      >
        <Sparkles size={12} className="text-clay" />
        Need an idea? Get 5 suggestions
      </button>

      {open && (
        <>
          <div className="flex items-center gap-2">
            <input
              value={seedTopic}
              onChange={(e) => setSeedTopic(e.target.value)}
              placeholder="Optional: point it toward a topic"
              className="flex-1 bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
            />
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="px-3 py-1.5 rounded-full bg-clay text-ink text-xs font-medium disabled:opacity-40 flex items-center gap-1.5 shrink-0"
            >
              {loading && <Loader2 size={12} className="animate-spin" />}
              {loading ? "Thinking…" : ideas ? "Regenerate" : "Generate"}
            </button>
          </div>

          {error && <p className="text-sm text-fire">{error}</p>}

          {ideas && (
            <div className="flex flex-col gap-2">
              {ideas.map((idea, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onUseIdea(idea.hook)}
                  className="text-left border border-line hover:border-clay rounded-xl p-3 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] uppercase tracking-wider ${FORMAT_COLOR[idea.format] || "text-muted"}`}>
                      {idea.format}
                    </span>
                    <span className="text-[10px] text-muted">
                      {idea.best_platform} · {idea.why}
                    </span>
                  </div>
                  <p className="text-sm text-cream leading-snug">{idea.hook}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-clay">
                    Use this <ArrowRight size={11} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
