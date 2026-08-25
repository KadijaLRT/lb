import { FileText } from "lucide-react";

const PROMPTS = ["Break this down", "I'm overwhelmed", "Plan next 2 hours"];

export default function QuickActions({ onPick, onScriptify, disabled, scriptDisabled }) {
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {PROMPTS.map((p) => (
        <button
          key={p}
          type="button"
          disabled={disabled}
          onClick={() => onPick(p)}
          className="text-sm px-3 py-1.5 rounded-full border border-line text-muted hover:text-cream hover:border-clay transition-colors disabled:opacity-40"
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={scriptDisabled}
        onClick={onScriptify}
        className="text-sm px-3 py-1.5 rounded-full border border-clay text-clay flex items-center gap-1.5 hover:bg-clay hover:text-ink transition-colors disabled:opacity-40"
      >
        <FileText size={13} />
        Turn this into a script
      </button>
    </div>
  );
}
