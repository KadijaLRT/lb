import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getTransactions } from "../lib/db.js";

export default function TransactionsAccordion({ accountId, refreshKey }) {
  const [open, setOpen] = useState(false);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !accountId) return;
    setLoading(true);
    getTransactions(accountId)
      .then(setTxns)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [open, accountId, refreshKey]);

  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-cream"
      >
        Recent transactions
        <ChevronDown size={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-line divide-y divide-line max-h-64 overflow-y-auto">
          {loading && <p className="p-4 text-sm text-muted">Loading…</p>}
          {!loading && txns.length === 0 && (
            <p className="p-4 text-sm text-muted italic">No transactions yet.</p>
          )}
          {txns.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div className="flex flex-col">
                <span className="text-cream">{t.note || t.category || "Expense"}</span>
                <span className="text-xs text-muted">
                  {t.category} · {new Date(t.occurred_at).toLocaleDateString()}
                </span>
              </div>
              <span className="text-cream">${Number(t.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
