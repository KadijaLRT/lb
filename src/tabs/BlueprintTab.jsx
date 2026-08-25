import { useState } from "react";
import { Settings } from "lucide-react";
import AstroSnapshot from "../components/AstroSnapshot.jsx";
import SettingsModal from "../components/SettingsModal.jsx";
import LifeAreaExplorer from "../components/LifeAreaExplorer.jsx";

export default function BlueprintTab({ profile, onSave }) {
  const [settingsOpen, setSettingsOpen] = useState(false);

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

      <AstroSnapshot sun={profile?.sun_sign} moon={profile?.moon_sign} rising={profile?.rising_sign} />

      <div className="border border-line rounded-2xl p-4 flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">Core goals</span>
        <p className="text-cream/90 leading-relaxed">
          {profile?.core_goals || "Nothing set yet — add your life vision notes here so the coach factors them into every response."}
        </p>
      </div>

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
