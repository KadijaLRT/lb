import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { getWeeklySpendTrend } from "../lib/db.js";

export default function SpendingTrend({ accountId, weeklyBudget, refreshKey }) {
  const [weeks, setWeeks] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accountId) return;
    getWeeklySpendTrend(accountId, 6)
      .then(setWeeks)
      .catch((err) => {
        console.error(err);
        setError("Couldn't load spending trend.");
      });
  }, [accountId, refreshKey]);

  if (error) return <p className="text-sm text-fire">{error}</p>;
  if (!weeks) return null;

  const max = Math.max(weeklyBudget, ...weeks.map((w) => w.total), 1);

  return (
    <div className="border border-line rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
        <TrendingUp size={12} />
        Last 6 weeks
      </div>
      <div className="flex items-end justify-between gap-2 h-24">
        {weeks.map((w, i) => {
          const isCurrent = i === weeks.length - 1;
          const over = w.total > weeklyBudget;
          const heightPct = Math.max(2, (w.total / max) * 100);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex flex-col justify-end h-16">
                <div
                  className={`w-full rounded-t transition-all ${
                    over ? "bg-fire" : isCurrent ? "bg-clay" : "bg-earth"
                  }`}
                  style={{ height: `${heightPct}%`, opacity: isCurrent ? 1 : 0.6 }}
                  title={`$${w.total}`}
                />
              </div>
              <span className="text-[10px] text-muted">{w.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-line">
        <span>Budget: ${weeklyBudget.toFixed(0)}/wk</span>
        <span>This week: ${weeks[weeks.length - 1]?.total.toFixed(0) ?? 0}</span>
      </div>
    </div>
  );
}
