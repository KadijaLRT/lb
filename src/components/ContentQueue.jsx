import { useEffect, useState } from "react";
import { ChevronDown, Check, Trash2 } from "lucide-react";
import { listScripts, updateScriptStatus, deleteScript } from "../lib/db.js";

const STATUS_CYCLE = { draft: "ready", ready: "posted", posted: "draft" };
const STATUS_LABEL = { draft: "Draft", ready: "Ready", posted: "Posted" };
const STATUS_COLOR = { draft: "text-muted", ready: "text-clay", posted: "text-earth" };

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
        <div className="border-t border-line divide-y divide-line max-h-80 overflow-y-auto">
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
                  className="text-left text-sm text-cream flex-1 line-clamp-2"
                >
                  {s.raw_brain_dump?.slice(0, 80) || "(no source text)"}
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
              {expandedId === s.id && (
                <p className="text-sm text-cream/90 whitespace-pre-wrap border-t border-line pt-2 mt-1">
                  {s.short_form_script}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
