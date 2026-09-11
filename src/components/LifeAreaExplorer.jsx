import { useEffect, useState } from "react";
import { Briefcase, Users, Heart, Wallet, RefreshCw, Loader2, Lightbulb } from "lucide-react";
import { getInsight, saveInsight } from "../lib/db.js";
import { localDateString } from "../lib/date.js";
import ChatFollowUp from "./ChatFollowUp.jsx";

const AREAS = [
  { key: "career", label: "Career", icon: Briefcase },
  { key: "friendships", label: "Friendships", icon: Users },
  { key: "love", label: "Love", icon: Heart },
  { key: "finance", label: "Finance", icon: Wallet },
];

// Cached rows store JSON now ({reading, action_ideas}), but older cached
// readings from before this change are plain prose strings — fall back to
// treating the whole thing as the reading with no action ideas rather than
// breaking on old data.
function parseStoredReading(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.reading === "string") {
      return { reading: parsed.reading, action_ideas: Array.isArray(parsed.action_ideas) ? parsed.action_ideas : [] };
    }
  } catch {
    // not JSON — must be an old plain-text cached reading
  }
  return { reading: raw, action_ideas: [] };
}

function ReadingBlock({ result }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-cream/90 leading-relaxed whitespace-pre-wrap">{result.reading}</p>
      {result.action_ideas?.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-line">
          <span className="text-xs uppercase tracking-[0.2em] text-clay flex items-center gap-1.5">
            <Lightbulb size={12} />
            Try this
          </span>
          {result.action_ideas.map((idea, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-cream/90">
              <span className="text-clay mt-1.5 w-1 h-1 rounded-full bg-clay shrink-0" />
              {idea}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LifeAreaExplorer({ profile }) {
  const [active, setActive] = useState("career");
  const [content, setContent] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const today = localDateString();

  useEffect(() => {
    if (!profile?.id || content[active] !== undefined) return;
    getInsight(profile.id, active, today)
      .then((row) => setContent((c) => ({ ...c, [active]: row?.content ? parseStoredReading(row.content) : null })))
      .catch(() => setContent((c) => ({ ...c, [active]: null })));
  }, [active, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/astrology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: active, profile, for_date: today }),
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          res.ok
            ? "Server returned an unreadable response."
            : `Server error (${res.status}): ${raw.slice(0, 200) || "no details"}`
        );
      }
      if (!res.ok) throw new Error(data.error || `Reading failed (${res.status}).`);

      const newContent = data.reading ? { reading: data.reading, action_ideas: data.action_ideas || [] } : null;
      setContent((c) => ({ ...c, [active]: newContent }));
      if (profile?.id && newContent) {
        saveInsight(profile.id, active, JSON.stringify(newContent), today).catch((e) => console.error(e));
      }
      if (!newContent) {
        setError("Got an empty reading back. Try again.");
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
        <p className="text-sm text-muted italic">
          No reading yet for this area — generate one below, or just start talking about what's on your mind in the chat underneath.
        </p>
      )}

      {current && <ReadingBlock result={current} />}

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

      {/*
        Merged "Ask about a specific situation" into this — they were the
        same feature wearing two different UIs (a generate-then-chat
        two-step vs. a chat that only appeared after a reading existed).
        Now there's just one persistent conversation per area, always
        available whether or not a daily reading exists yet. Whether your
        first message is "tell me more" or a real situation you want to
        talk through, it's the same chat — astrology-chat.js's system
        prompt reacts differently to a first message (like a friend hearing
        news) vs. a continuing one, so the tone difference that used to
        come from two separate code paths now comes from one, correctly.
      */}
      <ChatFollowUp area={active} profile={profile} priorReading={current?.reading} contextKey={`${active}:${today}`} />
    </div>
  );
}
