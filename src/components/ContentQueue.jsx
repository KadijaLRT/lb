import { useEffect, useState } from "react";
import { ChevronDown, Check, Trash2, Copy, Zap, TrendingUp } from "lucide-react";
import { listScripts, updateScriptStatus, deleteScript } from "../lib/db.js";

const STATUS_CYCLE = { draft: "ready", ready: "posted", posted: "draft" };
const STATUS_LABEL = { draft: "Draft", ready: "Ready", posted: "Posted" };
const STATUS_COLOR = { draft: "text-muted", ready: "text-clay", posted: "text-earth" };
const PLATFORM_TABS = [
  { label: "TikTok/Reels", key: "tiktok" },
  { label: "Instagram", key: "instagram" },
  { label: "X Post", key: "x" },
  { label: "Facebook", key: "facebook" },
];

function MiniCopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy(e) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // silent — this is a small inline affordance, a failed copy just doesn't confirm
    }
  }
  return (
    <button type="button" onClick={handleCopy} className="text-[10px] text-muted hover:text-cream flex items-center gap-1">
      <Copy size={10} />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// execution_steps used to be one shared array; now it's an object keyed by
// platform. Handles both shapes so older saved queue items still display.
function stepsForPlatform(executionSteps, platformKey) {
  if (!executionSteps) return [];
  if (Array.isArray(executionSteps)) return executionSteps;
  return executionSteps[platformKey] || [];
}

// Full multi-platform view for a saved queue item — reopening a queued
// idea should show everything that was generated (script, caption, X post,
// Facebook post, per-platform steps, the tip, why it might work), not just
// the main script.
function ExpandedQueueItem({ script }) {
  const [tab, setTab] = useState("tiktok");
  return (
    <div className="border-t border-line pt-2 mt-1 flex flex-col gap-2">
      {script.engagement_tip && (
        <div className="flex items-start gap-2 text-xs text-clay">
          <Zap size={11} className="shrink-0 mt-0.5" />
          {script.engagement_tip}
        </div>
      )}

      {script.algorithm_boost?.length > 0 && (
        <div className="flex flex-col gap-1 bg-panel/50 border border-line rounded-lg p-2">
          <span className="text-[9px] uppercase tracking-wider text-muted flex items-center gap-1">
            <TrendingUp size={10} />
            Why this could work
          </span>
          {script.algorithm_boost.map((item, i) => (
            <span key={i} className="text-[11px] text-cream/90">
              <span className="text-clay">{item.signal}:</span> {item.note}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {PLATFORM_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTab(t.key);
            }}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              tab === t.key ? "border-clay text-clay" : "border-line text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tiktok" && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-end">
            <MiniCopyButton text={script.short_form_script} />
          </div>
          <p className="text-sm text-cream/90 whitespace-pre-wrap">{script.short_form_script || "(none saved)"}</p>
        </div>
      )}
      {tab === "instagram" && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-end">
            <MiniCopyButton text={script.instagram_caption} />
          </div>
          <p className="text-sm text-cream/90 whitespace-pre-wrap">{script.instagram_caption || "(none saved)"}</p>
        </div>
      )}
      {tab === "x" && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-end">
            <MiniCopyButton text={script.x_thread} />
          </div>
          <p className="text-sm text-cream/90 whitespace-pre-wrap">{script.x_thread || "(none saved)"}</p>
        </div>
      )}
      {tab === "facebook" && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-end">
            <MiniCopyButton text={script.facebook_post} />
          </div>
          <p className="text-sm text-cream/90 whitespace-pre-wrap">{script.facebook_post || "(none saved)"}</p>
        </div>
      )}

      {stepsForPlatform(script.execution_steps, tab).length > 0 && (
        <div className="pt-1 border-t border-line flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">
            Steps — {PLATFORM_TABS.find((t) => t.key === tab)?.label}
          </span>
          {stepsForPlatform(script.execution_steps, tab).map((s, i) => (
            <span key={i} className="text-xs text-muted">
              {i + 1}. {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContentQueue({ profile, refreshKey }) {
  const [open, setOpen] = useState(false);
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!open || !profile?.id) return;
    setLoading(true);
    listScripts(profile.id, 20)
      .then(setScripts)
      .catch((err) => {
        console.error(err);
        setActionError("Couldn't load your queue.");
      })
      .finally(() => setLoading(false));
  }, [open, profile?.id, refreshKey]);

  async function cycleStatus(script) {
    const next = STATUS_CYCLE[script.status] || "draft";
    setActionError("");
    try {
      await updateScriptStatus(script.id, next);
      setScripts((prev) => prev.map((s) => (s.id === script.id ? { ...s, status: next } : s)));
    } catch (err) {
      console.error(err);
      setActionError("Couldn't update status.");
    }
  }

  async function remove(script) {
    setActionError("");
    try {
      await deleteScript(script.id);
      setScripts((prev) => prev.filter((s) => s.id !== script.id));
      setExpandedId((prev) => (prev === script.id ? null : prev));
    } catch (err) {
      console.error(err);
      setActionError("Couldn't delete that.");
    }
  }

  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-cream"
      >
        Your queue
        <ChevronDown size={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-line divide-y divide-line max-h-96 overflow-y-auto">
          {loading && <p className="p-4 text-sm text-muted">Loading…</p>}
          {actionError && <p className="px-4 pt-3 text-sm text-fire">{actionError}</p>}
          {!loading && scripts.length === 0 && (
            <p className="p-4 text-sm text-muted italic">Nothing saved yet — generate something above.</p>
          )}
          {scripts.map((s) => (
            <div key={s.id} className="p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  className="text-left text-sm text-cream flex-1"
                >
                  {s.raw_brain_dump || "(no source text)"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(s)}
                  aria-label="Delete"
                  className="text-muted hover:text-fire shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  {new Date(s.created_at).toLocaleDateString()} · {s.word_count} words
                </span>
                <button
                  type="button"
                  onClick={() => cycleStatus(s)}
                  className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full border border-line ${STATUS_COLOR[s.status] || "text-muted"}`}
                >
                  {s.status === "posted" && <Check size={11} />}
                  {STATUS_LABEL[s.status] || "Draft"}
                </button>
              </div>
              {expandedId === s.id && <ExpandedQueueItem script={s} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
