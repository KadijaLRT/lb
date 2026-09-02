import { useState } from "react";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import CoachResponse from "./CoachResponse.jsx";

const PROMPTS = [
  "What should I post today?",
  "Help me improve my last hook",
  "I'm out of ideas",
  "What's working lately?",
];

export default function ContentCoach({ profile }) {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(promptOverride) {
    const text = promptOverride || input;
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResponse("");
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Content coaching question (they're on the content creation page, not general life coaching). Important: don't default to suggestions centered on their goals — most content ideas should come from general life, opinions, and observations that have nothing to do with their goal list. Their question: ${text}`,
          context: profile
            ? {
                name: profile.name,
                pronoun: profile.pronoun,
                goals: profile.core_goals,
                voice_sample: profile.content_voice_sample,
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Coach request failed (${res.status})`);
      }
      const data = await res.json();
      setResponse(data.reply || "No response received.");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-line rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
        <Sparkles size={12} className="text-clay" />
        Ask your content coach
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your content"
          className="flex-1 bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Ask"
          className="w-8 h-8 rounded-full bg-clay text-ink flex items-center justify-center disabled:opacity-30 shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={loading}
            onClick={() => ask(p)}
            className="text-xs px-2.5 py-1 rounded-full border border-line text-muted hover:text-cream hover:border-clay transition-colors disabled:opacity-40"
          >
            {p}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-fire">{error}</p>}
      <CoachResponse text={response} loading={loading} />
    </div>
  );
}
