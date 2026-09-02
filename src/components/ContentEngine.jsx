import { useState } from "react";
import { Mic, Loader2, Copy, Check, Zap } from "lucide-react";
import IdeaGenerator from "./IdeaGenerator.jsx";

const TABS = ["TikTok/Reels", "Instagram", "X Post", "Facebook"];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text || "");
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`text-xs flex items-center gap-1 transition-colors ${
        failed ? "text-fire" : "text-muted hover:text-cream"
      }`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {failed ? "Couldn't copy" : copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function ContentEngine({ profile, onSaved }) {
  const [dump, setDump] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("TikTok/Reels");
  const [checkedSteps, setCheckedSteps] = useState({});

  async function transform(brainDumpOverride) {
    const text = brainDumpOverride ?? dump;
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setCheckedSteps({});
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brainDump: text, profile }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Content engine failed (${res.status})`);
      }
      const data = await res.json();
      setResult(data);
      onSaved?.(text, data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function useIdea(hook) {
    setDump(hook);
    transform(hook);
  }

  return (
    <div className="flex flex-col gap-4">
      <IdeaGenerator profile={profile} onUseIdea={useIdea} />

      <div className="border border-line rounded-2xl p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Mic size={14} className="text-clay" />
          <span className="text-xs uppercase tracking-[0.2em] text-muted">Brain dump → content</span>
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
          onClick={() => transform()}
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

            {result.engagement_tip && (
              <div className="flex items-start gap-2 text-xs text-clay border-l-2 border-clay pl-2">
                <Zap size={12} className="shrink-0 mt-0.5" />
                {result.engagement_tip}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
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

            {tab === "TikTok/Reels" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">{result.word_count} words · also works for IG/FB Reels</span>
                  <CopyButton text={result.tiktok_reels_script} />
                </div>
                <p className="text-cream/90 leading-relaxed whitespace-pre-wrap">{result.tiktok_reels_script}</p>
              </div>
            )}

            {tab === "Instagram" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Caption (post video from TikTok/Reels tab)</span>
                  <CopyButton text={result.instagram_caption} />
                </div>
                <p className="text-cream/90 leading-relaxed whitespace-pre-wrap">{result.instagram_caption}</p>
              </div>
            )}

            {tab === "X Post" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">{(result.x_post || "").length} characters</span>
                  <CopyButton text={result.x_post} />
                </div>
                <p className="text-cream/90 text-sm whitespace-pre-wrap">{result.x_post}</p>
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

            {result.execution_steps?.length > 0 && (
              <div className="mt-2 pt-3 border-t border-line flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-[0.2em] text-muted mb-1">Exact steps</span>
                {result.execution_steps.map((s, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={!!checkedSteps[i]}
                      onChange={() => setCheckedSteps((prev) => ({ ...prev, [i]: !prev[i] }))}
                      className="accent-[#C96A4B]"
                    />
                    <span className={checkedSteps[i] ? "line-through text-muted/60" : ""}>{s}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
