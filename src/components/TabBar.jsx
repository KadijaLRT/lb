import { Zap, Mic, Wallet, Sparkles } from "lucide-react";

const TABS = [
  { key: "action", label: "Action", icon: Zap },
  { key: "content", label: "Content", icon: Mic },
  { key: "finance", label: "Finance", icon: Wallet },
  { key: "blueprint", label: "Blueprint", icon: Sparkles },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-panel border-t border-line z-40">
      <div className="max-w-xl mx-auto grid grid-cols-4">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                isActive ? "text-clay" : "text-muted"
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.4 : 1.8} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
