import { useEffect, useState } from "react";
import { Briefcase, Users, Heart, Wallet, Globe, RefreshCw, Loader2 } from "lucide-react";
import { getInsight, saveInsight } from "../lib/db.js";

const AREAS = [
  { key: "career", label: "Career", icon: Briefcase },
  { key: "friendships", label: "Friendships", icon: Users },
  { key: "love", label: "Love", icon: Heart },
  { key: "finance", label: "Finance", icon: Wallet },
  { key: "astrocartography", label: "Astrocartography", icon: Globe },
];

export default function LifeAreaExplorer({ profile }) {
  const [active, setActive] = useState("career");
  const [content, setContent] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!profile?.id || content[active] !== undefined) return;
    getInsight(profile.id, active, today)
      .then((row) => setContent((c) => ({ ...c, [active]: row?.content || null })))
      .catch(() => setContent((c) => ({ ...c, [active]: null })));
  }, [active, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/astrology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: active, profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reading failed.");
      setContent((c) => ({ ...c, [active]: data.content }));
      if (profile?.id) {
        saveInsight(profile.id, active, data.content, today).catch((e) => console.error(e));
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const current = content[active];

  return (
    <div className="border border-line rounded-2xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">Go deeper — today</span>
        <span className="text-xs text-muted">{today}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {AREAS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-colors ${
              active === key ? "border-clay text-clay" : "border-line text-muted hover:text-cream"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {current === undefined && <p className="text-sm text-muted">Loading…</p>}

      {current === null && (
        <p className="text-sm text-muted italic">No reading yet for this area.</p>
      )}

      {current && <p className="text-cream/90 leading-relaxed whitespace-pre-wrap">{current}</p>}

      {error && <p className="text-sm text-fire">{error}</p>}

      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="self-start px-3 py-1.5 rounded-full border border-line hover:border-clay text-sm flex items-center gap-2 disabled:opacity-40"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        {current ? "Regenerate for today" : "Generate today's reading"}
      </button>
    </div>
  );
}
