import { useState } from "react";
import { Mic, Loader2, Copy, Check, Zap, RefreshCw, TrendingUp } from "lucide-react";
import IdeaGenerator from "./IdeaGenerator.jsx";

const TABS = [
  { label: "TikTok/Reels", key: "tiktok" },
  { label: "Instagram", key: "instagram" },
  { label: "X Post", key: "x" },
  { label: "Facebook", key: "facebook" },
];

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

// execution_steps used to be one shared array; now it's an object keyed by
// platform. Handles both shapes so older saved queue items don't break.
function stepsForPlatform(executionSteps, platformKey) {
  if (!executionSteps) return [];
  if (Array.isArray(executionSteps)) return executionSteps; // old shared-list shape
  return executionSteps[platformKey] || [];
}

export default function ContentEngine({ profile, onSaved }) {
  const [dump, setDump] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("tiktok");
  const [checkedSteps, setCheckedSteps] = useState({});
  const [activeHook, setActiveHook] = useState(0); // 0 = original, 1/2 = variants

  async function transform(brainDumpOverride) {
    const text = brainDumpOverride ?? dump;
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setCheckedSteps({});
    setActiveHook(0);
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

  const hookOptions = result ? [result.tiktok_reels_script, ...(result.hook_variants || [])] : [];
  const currentScript = hookOptions[activeHook] || result?.tiktok_reels_script;

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

            {result.algorithm_boost?.length > 0 && (
              <div className="flex flex-col gap-1.5 bg-panel/50 border border-line rounded-xl p-3">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted flex items-center gap-1.5">
                  <TrendingUp size={11} />
                  Why this could work — real platform signals, not a guarantee
                </span>
                {result.algorithm_boost.map((item, i) => (
                  <div key={i} className="text-xs text-cream/90">
                    <span className="text-clay font-medium">{item.signal}:</span> {item.note}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    tab === t.key ? "border-clay text-clay" : "border-line text-muted hover:text-cream"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "tiktok" && (
              <div className="flex flex-col gap-2">
                {hookOptions.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {hookOptions.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveHook(i)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          activeHook === i ? "border-clay text-clay" : "border-line text-muted"
                        }`}
                      >
                        {i === 0 ? "Original" : `Alt hook ${i}`}
                        {activeHook !== i && <RefreshCw size={9} />}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">
                    {activeHook === 0 ? `${result.word_count} words · ` : ""}also works for IG/FB Reels
                  </span>
                  <CopyButton text={currentScript} />
                </div>
                <p className="text-cream/90 leading-relaxed whitespace-pre-wrap">{currentScript}</p>
              </div>
            )}

            {tab === "instagram" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Caption (post video from TikTok/Reels tab)</span>
                  <CopyButton text={result.instagram_caption} />
                </div>
                <p className="text-cream/90 leading-relaxed whitespace-pre-wrap">{result.instagram_caption}</p>
              </div>
            )}

            {tab === "x" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">{(result.x_post || "").length} characters</span>
                  <CopyButton text={result.x_post} />
                </div>
                <p className="text-cream/90 text-sm whitespace-pre-wrap">{result.x_post}</p>
              </div>
            )}

            {tab === "facebook" && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-end">
                  <CopyButton text={result.facebook_post} />
                </div>
                <p className="text-cream/90 text-sm whitespace-pre-wrap">{result.facebook_post}</p>
              </div>
            )}

            {stepsForPlatform(result.execution_steps, tab).length > 0 && (
              <div className="mt-2 pt-3 border-t border-line flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-[0.2em] text-muted mb-1">
                  Exact steps — {TABS.find((t) => t.key === tab)?.label}
                </span>
                {stepsForPlatform(result.execution_steps, tab).map((s, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={!!checkedSteps[`${tab}-${i}`]}
                      onChange={() => setCheckedSteps((prev) => ({ ...prev, [`${tab}-${i}`]: !prev[`${tab}-${i}`] }))}
                      className="accent-[#C96A4B]"
                    />
                    <span className={checkedSteps[`${tab}-${i}`] ? "line-through text-muted/60" : ""}>{s}</span>
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
