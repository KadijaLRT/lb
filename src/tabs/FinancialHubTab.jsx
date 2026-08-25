import { useState } from "react";
import FinancePulse from "../components/FinancePulse.jsx";
import ExpenseModal from "../components/ExpenseModal.jsx";
import ImpulsePause from "../components/ImpulsePause.jsx";
import PlaidLinkButton from "../components/PlaidLinkButton.jsx";
import TransactionsAccordion from "../components/TransactionsAccordion.jsx";

export default function FinancialHubTab({ profile, account, weekSpend, onLogExpense, onLinked, onSynced }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [syncTick, setSyncTick] = useState(0);

  const weeklyBudget = account?.weekly_spend_limit ?? 200;
  const safeToSpend = Math.max(0, weeklyBudget - weekSpend);
  const bankLinked = account?.provider === "plaid";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Financial Hub</p>

      <FinancePulse
        safeToSpend={safeToSpend}
        weeklyBudget={weeklyBudget}
        onLogExpense={() => setModalOpen(true)}
      />

      <div className="flex items-center justify-between">
        <ImpulsePause
          context={
            profile
              ? { sun: profile.sun_sign, moon: profile.moon_sign, rising: profile.rising_sign }
              : undefined
          }
        />
        {profile && account && (
          <PlaidLinkButton
            userId={profile.id}
            accountId={account.id}
            linked={bankLinked}
            onLinked={onLinked}
            onSynced={() => {
              onSynced();
              setSyncTick((t) => t + 1);
            }}
          />
        )}
      </div>

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
