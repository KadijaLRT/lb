import { useState } from "react";
import TabBar from "./components/TabBar.jsx";
import ActionCenterTab from "./tabs/ActionCenterTab.jsx";
import ContentEngineTab from "./tabs/ContentEngineTab.jsx";
import FinancialHubTab from "./tabs/FinancialHubTab.jsx";
import BlueprintTab from "./tabs/BlueprintTab.jsx";
import { useKadijaData } from "./lib/useKadijaData.js";
import { logExpense, saveScript } from "./lib/db.js";

const TAB_TITLES = {
  action: "Action Center",
  content: "Content Engine",
  finance: "Financial Hub",
  blueprint: "Blueprint & Chart",
};

export default function App() {
  const {
    profile,
    blueprint,
    account,
    weekSpend,
    ready,
    dbError,
    setMicroTasks,
    saveProfileFields,
    refreshSpend,
  } = useKadijaData();

  const [tab, setTab] = useState("action");

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
        short_form_script: result.tiktok_reels_script,
        instagram_caption: result.instagram_caption,
        x_thread: result.x_post || "",
        facebook_post: result.facebook_post,
        execution_steps: result.execution_steps || {},
        hook_variants: result.hook_variants || [],
        algorithm_boost: result.algorithm_boost || [],
        engagement_tip: result.engagement_tip,
        word_count: result.word_count,
        status: "draft",
      });
    } catch (err) {
      console.error("Couldn't save script:", err);
      throw err; // let callers (Action Center, Content Engine) know it actually failed
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-xl mx-auto px-5 pt-10 pb-28 flex flex-col gap-6">
        <header>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">{profile?.name || "Kadija"}</p>
          <h1 className="font-display text-4xl text-cream">{TAB_TITLES[tab]}</h1>
          {dbError && <p className="text-xs text-fire mt-2">{dbError}</p>}
        </header>

        {tab === "action" && (
          <ActionCenterTab
            profile={profile}
            blueprint={blueprint}
            onSaveTasks={setMicroTasks}
            onContentSaved={handleScriptSaved}
            onViewContent={() => setTab("content")}
          />
        )}
        {tab === "content" && <ContentEngineTab profile={profile} onSaved={handleScriptSaved} />}
        {tab === "finance" && (
          <FinancialHubTab
            profile={profile}
            account={account}
            weekSpend={weekSpend}
            onLogExpense={handleLogExpense}
          />
        )}
        {tab === "blueprint" && <BlueprintTab profile={profile} onSave={saveProfileFields} />}

        {!ready && <p className="text-xs text-muted">Loading your blueprint…</p>}
      </div>

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
