import { useState } from "react";
import { Plus } from "lucide-react";
import FinancePulse from "../components/FinancePulse.jsx";
import ExpenseModal from "../components/ExpenseModal.jsx";
import ImpulsePause from "../components/ImpulsePause.jsx";
import TransactionsAccordion from "../components/TransactionsAccordion.jsx";
import SpendingTrend from "../components/SpendingTrend.jsx";
import JobApplicationTracker from "../components/JobApplicationTracker.jsx";

export default function FinancialHubTab({ profile, account, weekSpend, onLogExpense }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [syncTick, setSyncTick] = useState(0);

  const weeklyBudget = account?.weekly_spend_limit ?? 200;
  const safeToSpend = Math.max(0, weeklyBudget - weekSpend);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Financial Hub</p>

      <FinancePulse
        safeToSpend={safeToSpend}
        weeklyBudget={weeklyBudget}
        onLogExpense={() => setModalOpen(true)}
      />

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-clay text-ink font-medium text-sm"
      >
        <Plus size={16} />
        Log spending
      </button>

      <ImpulsePause
        context={
          profile
            ? { sun: profile.sun_sign, moon: profile.moon_sign, rising: profile.rising_sign }
            : undefined
        }
      />

      {account && <SpendingTrend accountId={account.id} weeklyBudget={weeklyBudget} refreshKey={syncTick} />}

      <JobApplicationTracker profile={profile} />

      {account && <TransactionsAccordion accountId={account.id} refreshKey={syncTick} />}

      <ExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (payload) => {
          await onLogExpense(payload);
          setSyncTick((t) => t + 1);
        }}
      />
    </div>
  );
}
