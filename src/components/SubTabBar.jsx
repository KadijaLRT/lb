export default function SubTabBar({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-colors ${
              isActive ? "border-clay text-clay" : "border-line text-muted hover:text-cream"
            }`}
          >
            {Icon && <Icon size={12} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
