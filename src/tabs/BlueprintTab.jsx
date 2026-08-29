import { useState } from "react";
import { Settings, ChevronDown } from "lucide-react";
import AstroSnapshot from "../components/AstroSnapshot.jsx";
import SettingsModal from "../components/SettingsModal.jsx";
import LifeAreaExplorer from "../components/LifeAreaExplorer.jsx";
import GoalsTracker from "../components/GoalsTracker.jsx";
import FullChartReading from "../components/FullChartReading.jsx";

export default function BlueprintTab({ profile, onSave }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [goalsListOpen, setGoalsListOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Blueprint & Chart</p>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Edit details"
          className="w-8 h-8 rounded-full border border-line hover:border-clay flex items-center justify-center transition-colors"
        >
          <Settings size={14} />
        </button>
      </div>

      <AstroSnapshot
        sun={profile?.sun_sign}
        moon={profile?.moon_sign}
        rising={profile?.rising_sign}
        natalChartNotes={profile?.natal_chart_notes}
      />

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
                Nothing set yet — add your life vision notes here so the coach factors them into every response.
              </p>
            )}
          </div>
        )}
      </div>

      <GoalsTracker profile={profile} />

      <FullChartReading profile={profile} />

      <LifeAreaExplorer profile={profile} />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={profile}
        onSave={onSave}
      />
    </div>
  );
}
