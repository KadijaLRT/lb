import { useState } from "react";
import { Settings } from "lucide-react";
import PrimaryAction from "./components/PrimaryAction.jsx";
import QuickActions from "./components/QuickActions.jsx";
import CoachResponse from "./components/CoachResponse.jsx";
import AstroSnapshot from "./components/AstroSnapshot.jsx";
import FinancePulse from "./components/FinancePulse.jsx";
import ExpenseModal from "./components/ExpenseModal.jsx";
import ContentEngine from "./components/ContentEngine.jsx";
import PlaidLinkButton from "./components/PlaidLinkButton.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import { useKadijaData } from "./lib/useKadijaData.js";
import { logExpense, saveScript } from "./lib/db.js";

export default function App() {
  const {
    profile,
    blueprint,
    account,
    weekSpend,
    ready,
    dbError,
    setFocus,
    saveProfileFields,
    refreshSpend,
    refreshAccount,
  } = useKadijaData();

  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function ask(promptOverride) {
    const message = promptOverride ? `${promptOverride}: ${input || "(no extra context)"}` : input;
    setLoading(true);
    setError("");
    setResponse("");
    try {
      const res = await fetch("/api/coach.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context: profile
            ? { sun: profile.sun_sign, moon: profile.moon_sign, rising: profile.rising_sign }
            : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Coach request failed (${res.status})`);
      const data = await res.json();
      setResponse(data.reply || "No response received.");
      if (profile && input.trim()) {
        setFocus(input.trim(), null).catch((e) => console.error(e));
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogExpense({ amount, category, note }) {
    if (!account) return;
    await logExpense(account.id, { amount, category, note });
    await refreshSpend(account);
  }

  async function handleScriptSaved(dump, result) {
    if (!profile) return;
    try {
      await saveScript(profile.id, {
        raw_brain_dump: dump,
        short_form_script: result.short_form_script,
        x_thread: (result.x_thread || []).join("\n"),
        facebook_post: result.facebook_post,
        word_count: result.word_count,
        status: "draft",
      });
    } catch (err) {
      console.error("Couldn't save script:", err);
    }
  }

  const weeklyBudget = account?.weekly_spend_limit ?? 200;
  const safeToSpend = Math.max(0, weeklyBudget - weekSpend);
  const bankLinked = account?.provider === "plaid";

  return (
    <div className="min-h-screen max-w-xl mx-auto px-5 py-10 flex flex-col gap-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">{profile?.name || "Kadija"}</p>
          <h1 className="font-display text-4xl text-cream">Life Blueprint</h1>
          {dbError && <p className="text-xs text-fire mt-2">{dbError}</p>}
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="w-9 h-9 rounded-full border border-line hover:border-clay flex items-center justify-center transition-colors mt-1"
        >
          <Settings size={16} />
        </button>
      </header>

      <section>
        <PrimaryAction value={input} onChange={setInput} onSubmit={() => ask()} loading={loading} />
        <QuickActions onPick={(p) => ask(p)} disabled={loading} />
        {error && <p className="mt-4 text-sm text-fire">{error}</p>}
        <CoachResponse text={response} loading={loading} />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <AstroSnapshot
          sun={profile?.sun_sign}
          moon={profile?.moon_sign}
          rising={profile?.rising_sign}
        />
        <FinancePulse
          safeToSpend={safeToSpend}
          weeklyBudget={weeklyBudget}
          onLogExpense={() => setExpenseOpen(true)}
        />
      </section>

      {profile && account && (
        <section className="flex justify-end -mt-4">
          <PlaidLinkButton
            userId={profile.id}
            accountId={account.id}
            linked={bankLinked}
            onLinked={refreshAccount}
            onSynced={() => refreshSpend(account)}
          />
        </section>
      )}

      <section>
        <ContentEngine onSaved={handleScriptSaved} />
      </section>

      <ExpenseModal open={expenseOpen} onClose={() => setExpenseOpen(false)} onSubmit={handleLogExpense} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={profile}
        onSave={saveProfileFields}
      />

      {!ready && <p className="text-xs text-muted">Loading your blueprint…</p>}
    </div>
  );
}
