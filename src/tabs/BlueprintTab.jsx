import { useState } from "react";
import { Sparkles, Target, Compass, Settings as SettingsIcon, ChevronDown } from "lucide-react";
import SubTabBar from "../components/SubTabBar.jsx";
import AstroSnapshot from "../components/AstroSnapshot.jsx";
import FullChartReading from "../components/FullChartReading.jsx";
import SettingsPage from "../components/SettingsPage.jsx";
import LifeAreaExplorer from "../components/LifeAreaExplorer.jsx";
import GoalsTracker from "../components/GoalsTracker.jsx";

const SUB_TABS = [
  { key: "chart", label: "Chart", icon: Sparkles },
  { key: "goals", label: "Goals", icon: Target },
  { key: "explore", label: "Explore", icon: Compass },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

export default function BlueprintTab({ profile, onSave }) {
  const [subTab, setSubTab] = useState("chart");
  const [goalsListOpen, setGoalsListOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === "chart" && (
        <div className="flex flex-col gap-6">
          <AstroSnapshot
            sun={profile?.sun_sign}
            moon={profile?.moon_sign}
            rising={profile?.rising_sign}
            natalChartNotes={profile?.natal_chart_notes}
          />
          <FullChartReading profile={profile} />
        </div>
      )}

      {subTab === "goals" && (
        <div className="flex flex-col gap-6">
          <div className="border border-line rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setGoalsListOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Core goals</span>
              <ChevronDown size={16} className={`text-muted transition-transform ${goalsListOpen ? "rotate-180" : ""}`} />
            </button>
            {goalsListOpen && (
              <div className="border-t border-line p-4">
                {profile?.core_goals ? (
                  <ul className="flex flex-col gap-1.5">
                    {profile.core_goals
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, i) => (
                        <li key={i} className="flex items-start gap-2 text-cream/90 leading-relaxed">
                          <span className="text-clay mt-1.5 w-1 h-1 rounded-full bg-clay shrink-0" />
                          {line}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-cream/90 leading-relaxed">
                    Nothing set yet — add your life vision notes in Settings so the coach factors them into every response.
                  </p>
                )}
              </div>
            )}
          </div>

          <GoalsTracker profile={profile} />
        </div>
      )}

      {subTab === "explore" && <LifeAreaExplorer profile={profile} />}

      {subTab === "settings" && <SettingsPage profile={profile} onSave={onSave} />}
    </div>
  );
}
