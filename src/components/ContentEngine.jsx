import { useState } from "react";
import { Mic, Loader2, Copy, Check } from "lucide-react";

const TABS = ["Script", "X Thread", "Facebook"];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs flex items-center gap-1 text-muted hover:text-cream transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function ContentEngine({ onSaved }) {
  const [dump, setDump] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("Script");

  async function transform() {
    if (!dump.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brainDump: dump }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Content engine failed (${res.status})`);
      }
      const data = await res.json();
      setResult(data);
      onSaved?.(dump, data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const scriptSteps = [
    "Read the hook line 1 on camera.",
    "Say the rest, don't overthink takes.",
    "Grab 5s of b-roll that matches the hook.",
    "Upload with the caption from the X thread.",
  ];

  return (
    <div className="border border-line rounded-2xl p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Mic size={14} className="text-clay" />
        <span className="text-xs uppercase tracking-[0.2em] text-muted">Brain dump → script</span>
      </div>

      <textarea
        value={dump}
        onChange={(e) => setDump(e.target.value)}
        rows={4}
        placeholder="Ramble freely. Don't structure it, just talk."
        className="w-full bg-transparent border border-line rounded-xl p-3 text-cream placeholder:text-muted/60 outline-none focus:border-clay resize-none"
      />

      <button
        type="button"
        onClick={transform}
        disabled={loading || !dump.trim()}
        className="self-start px-4 py-2 rounded-xl bg-clay text-ink text-sm font-medium disabled:opacity-40 flex items-center gap-2"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {loading ? "Cutting the fluff…" : "Turn into content"}
      </button>

      {error && <p className="text-sm text-fire">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3 pt-2 border-t border-line">
          <p className="text-sm text-muted italic">{result.core_message}</p>

          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  tab === t ? "border-clay text-clay" : "border-line text-muted hover:text-cream"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Script" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{result.word_count} words</span>
                <CopyButton text={result.short_form_script} />
              </div>
              <p className="text-cream/90 leading-relaxed whitespace-pre-wrap">{result.short_form_script}</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {scriptSteps.map((s, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm text-muted">
                    <input type="checkbox" className="accent-[#D97757]" />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          )}

          {tab === "X Thread" && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end">
                <CopyButton text={(result.x_thread || []).join("\n\n")} />
              </div>
              {(result.x_thread || []).map((line, i) => (
                <p key={i} className="text-cream/90 text-sm">
                  {i + 1}/ {line}
                </p>
              ))}
            </div>
          )}

          {tab === "Facebook" && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end">
                <CopyButton text={result.facebook_post} />
              </div>
              <p className="text-cream/90 text-sm whitespace-pre-wrap">{result.facebook_post}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
