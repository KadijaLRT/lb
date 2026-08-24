const PROMPTS = [
  "Break this down",
  "I'm overwhelmed",
  "Plan next 2 hours",
  "Turn this into a script",
];

export default function QuickActions({ onPick, disabled }) {
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
    </div>
  );
}
