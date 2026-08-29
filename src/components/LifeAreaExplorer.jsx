import { useEffect, useState } from "react";
import { Briefcase, Users, Heart, Wallet, RefreshCw, Loader2, Lightbulb, MessageCircleQuestion, X } from "lucide-react";
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

  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenarioText, setScenarioText] = useState("");
  const [scenarioResult, setScenarioResult] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState("");

  useEffect(() => {
    if (!profile?.id || content[active] !== undefined) return;
    getInsight(profile.id, active, today)
      .then((row) => setContent((c) => ({ ...c, [active]: row?.content ? parseStoredReading(row.content) : null })))
      .catch(() => setContent((c) => ({ ...c, [active]: null })));
  }, [active, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the scenario panel when switching areas — a situation answered
  // under "Love" shouldn't linger when you tap over to "Finance."
  useEffect(() => {
    setScenarioResult(null);
    setScenarioError("");
  }, [active]);

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

  async function askScenario() {
    if (!scenarioText.trim()) return;
    setScenarioLoading(true);
    setScenarioError("");
    setScenarioResult(null);
    try {
      const res = await fetch("/api/astrology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: active, profile, for_date: today, scenario: scenarioText }),
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
      if (!res.ok) throw new Error(data.error || `Couldn't get advice (${res.status}).`);
      if (!data.reading) {
        setScenarioError("Got an empty response back. Try again.");
        return;
      }
      // Deliberately not saved/cached — this is a one-off ask, not the
      // day's fixed reading, so it shouldn't overwrite anything.
      setScenarioResult({ reading: data.reading, action_ideas: data.action_ideas || [] });
    } catch (err) {
      setScenarioError(err.message || "Something went wrong.");
    } finally {
      setScenarioLoading(false);
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

      {current && (
        <>
          <ReadingBlock result={current} />
          <ChatFollowUp area={active} profile={profile} priorReading={current.reading} />
        </>
      )}

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

      <div className="pt-3 border-t border-line flex flex-col gap-3">
        {!scenarioOpen ? (
          <button
            type="button"
            onClick={() => setScenarioOpen(true)}
            className="self-start flex items-center gap-1.5 text-sm text-clay hover:underline"
          >
            <MessageCircleQuestion size={14} />
            Ask about a specific situation
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Describe what's going on ({AREAS.find((a) => a.key === active)?.label})
              </span>
              <button
                type="button"
                onClick={() => {
                  setScenarioOpen(false);
                  setScenarioText("");
                  setScenarioResult(null);
                  setScenarioError("");
                }}
                className="text-muted hover:text-cream"
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              value={scenarioText}
              onChange={(e) => setScenarioText(e.target.value)}
              rows={3}
              placeholder="e.g. 'Deciding whether to take a job offer that pays more but feels less stable' or 'Trying to figure out why a friendship's felt off lately'"
              className="w-full bg-transparent border border-line rounded-xl p-3 text-sm text-cream placeholder:text-muted/60 outline-none focus:border-clay resize-none"
            />
            <button
              type="button"
              onClick={askScenario}
              disabled={scenarioLoading || !scenarioText.trim()}
              className="self-start px-4 py-1.5 rounded-full bg-clay text-ink text-sm font-medium disabled:opacity-40 flex items-center gap-2"
            >
              {scenarioLoading && <Loader2 size={12} className="animate-spin" />}
              {scenarioLoading ? "Thinking…" : "Get advice"}
            </button>

            {scenarioError && <p className="text-sm text-fire">{scenarioError}</p>}
            {scenarioResult && (
              <div className="pt-2 border-t border-line flex flex-col gap-3">
                <ReadingBlock result={scenarioResult} />
                <ChatFollowUp area={active} profile={profile} priorReading={scenarioResult.reading} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
