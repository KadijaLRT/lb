import { Plus, X } from "lucide-react";
import { useState } from "react";

export default function MicroTaskList({ tasks = [], onChange }) {
  const [draft, setDraft] = useState("");

  function toggle(i) {
    const next = tasks.map((t, idx) => (idx === i ? { ...t, done: !t.done } : t));
    onChange(next);
  }

  function remove(i) {
    onChange(tasks.filter((_, idx) => idx !== i));
  }

  function add(e) {
    e.preventDefault();
    if (!draft.trim() || tasks.length >= 3) return;
    onChange([...tasks, { text: draft.trim(), done: false }]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-[0.2em] text-muted">
        Right now ({tasks.length}/3)
      </span>
      {tasks.length === 0 && (
        <p className="text-sm text-muted italic">Nothing queued. Add one tiny thing.</p>
      )}
      <ul className="flex flex-col gap-2">
        {tasks.map((t, i) => (
          <li key={i} className="flex items-center gap-3 group">
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-label={t.done ? "Mark undone" : "Mark done"}
              className={`w-5 h-5 rounded-full border shrink-0 transition-colors ${
                t.done ? "bg-clay border-clay" : "border-line"
              }`}
            />
            <span className={`flex-1 text-cream ${t.done ? "line-through text-muted" : ""}`}>
              {t.text}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove"
              className="text-muted hover:text-fire transition-opacity"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      {tasks.length < 3 && (
        <form onSubmit={add} className="flex items-center gap-2 pt-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a micro-task"
            className="flex-1 bg-transparent border-b border-line focus:border-clay outline-none text-sm py-1 placeholder:text-muted/60"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Add task"
            className="w-7 h-7 rounded-full border border-line hover:border-clay flex items-center justify-center disabled:opacity-30 transition-colors"
          >
            <Plus size={14} />
          </button>
        </form>
      )}
    </div>
  );
}
