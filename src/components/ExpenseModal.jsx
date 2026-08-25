import { useState } from "react";
import { X } from "lucide-react";

const CATEGORIES = ["Food", "Tech", "Fun", "Bills", "Other"];

export default function ExpenseModal({ open, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit({ amount: value, category, note: "" });
      setAmount("");
      onClose();
    } catch (err) {
      console.error("Expense log failed:", err);
      setError(err.message || "Couldn't save that expense. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-cream/30 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm bg-panel border border-line rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-cream">Log expense</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="$0"
            className="w-full bg-transparent border-b border-line focus:border-clay outline-none text-3xl font-display text-cream py-1"
          />
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  category === c
                    ? "border-clay text-clay"
                    : "border-line text-muted hover:text-cream"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-fire">{error}</p>}
          <button
            type="submit"
            disabled={saving || !amount}
            className="w-full py-2.5 rounded-xl bg-clay text-ink font-medium disabled:opacity-40"
          >
            {saving ? "Saving…" : "Log it"}
          </button>
        </form>
      </div>
    </div>
  );
}
