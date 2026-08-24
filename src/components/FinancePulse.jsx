import { Plus } from "lucide-react";

export default function FinancePulse({ safeToSpend = 0, weeklyBudget = 1, onLogExpense }) {
  const pct = Math.max(0, Math.min(100, (safeToSpend / weeklyBudget) * 100));
  return (
    <div className="border border-line rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">Safe to spend</span>
        <button
          type="button"
          onClick={onLogExpense}
          aria-label="Log expense"
          className="w-7 h-7 rounded-full border border-line hover:border-clay flex items-center justify-center transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
      <p className="font-display text-3xl text-cream">${safeToSpend.toFixed(0)}</p>
      <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
        <div className="h-full bg-earth transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted">of ${weeklyBudget.toFixed(0)} weekly budget</span>
    </div>
  );
}
