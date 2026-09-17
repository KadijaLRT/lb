import { useState } from "react";
import { Plus, Wallet, HandCoins, Briefcase } from "lucide-react";
import SubTabBar from "../components/SubTabBar.jsx";
import FinancePulse from "../components/FinancePulse.jsx";
import ExpenseModal from "../components/ExpenseModal.jsx";
import ImpulsePause from "../components/ImpulsePause.jsx";
import TransactionsAccordion from "../components/TransactionsAccordion.jsx";
import SpendingTrend from "../components/SpendingTrend.jsx";
import JobApplicationTracker from "../components/JobApplicationTracker.jsx";

const SUB_TABS = [
  { key: "overview", label: "Overview", icon: Wallet },
  { key: "impulse", label: "Impulse Check", icon: HandCoins },
  { key: "jobs", label: "Jobs", icon: Briefcase },
];

export default function FinancialHubTab({ profile, account, weekSpend, onLogExpense }) {
  const [subTab, setSubTab] = useState("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [syncTick, setSyncTick] = useState(0);

  const weeklyBudget = account?.weekly_spend_limit ?? 200;
  const safeToSpend = Math.max(0, weeklyBudget - weekSpend);

  return (
    <div className="flex flex-col gap-6">
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === "overview" && (
        <div className="flex flex-col gap-6">
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

          {account && <SpendingTrend accountId={account.id} weeklyBudget={weeklyBudget} refreshKey={syncTick} />}

          {account && <TransactionsAccordion accountId={account.id} refreshKey={syncTick} />}
        </div>
      )}

      {subTab === "impulse" && (
        <ImpulsePause
          context={
            profile
              ? { sun: profile.sun_sign, moon: profile.moon_sign, rising: profile.rising_sign, voice_sample: profile.content_voice_sample }
              : undefined
          }
        />
      )}

      {subTab === "jobs" && <JobApplicationTracker profile={profile} />}

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
