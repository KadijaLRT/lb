import { useEffect, useState } from "react";
import { Loader2, Check, ArrowRight, Plus } from "lucide-react";
import PrimaryAction from "../components/PrimaryAction.jsx";
import QuickActions from "../components/QuickActions.jsx";
import CoachResponse from "../components/CoachResponse.jsx";
import MicroTaskList from "../components/MicroTaskList.jsx";
import { extractStepsFromReply, truncateForTaskList } from "../lib/extractSteps.js";
import { listGoals, listJobApplications } from "../lib/db.js";
import { summarizeGoalsProgress } from "../lib/goalProgress.js";

export default function ActionCenterTab({ profile, blueprint, onSaveTasks, onContentSaved, onViewContent }) {
  const [vibe, setVibe] = useState("");
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptError, setScriptError] = useState("");
  const [scriptSaved, setScriptSaved] = useState(false);
  const [candidateSteps, setCandidateSteps] = useState([]);
  const [addedSteps, setAddedSteps] = useState({});
  const [goalsProgress, setGoalsProgress] = useState("");

  useEffect(() => {
    // Intentionally NOT sending for_date here — this is the Action Center's
    // live vibe banner, meant to update in real time as you use the app.
    // The Blueprint tab's AstroSnapshot is the stable "today" snapshot
    // (pinned to noon UTC of the day so it doesn't flicker); this one is
    // deliberately the opposite by request — live, not pinned.
    fetch("/api/transits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sun: profile?.sun_sign,
        moon: profile?.moon_sign,
        rising: profile?.rising_sign,
        natal_chart_notes: profile?.natal_chart_notes,
      }),
    })
      .then((r) => r.json())
      .then((d) => setVibe(d.vibe || ""))
      .catch(() => setVibe(""));
  }, [profile?.sun_sign, profile?.moon_sign, profile?.rising_sign, profile?.natal_chart_notes]);

  useEffect(() => {
    if (!profile?.id) return;
    listGoals(profile.id)
      .then(async (goals) => {
        const needsJobApps = goals.some((g) => g.type === "salary");
        const jobApps = needsJobApps ? await listJobApplications(profile.id).catch(() => []) : [];
        setGoalsProgress(summarizeGoalsProgress(goals, jobApps));
      })
      .catch((err) => console.error("Couldn't load goals for coach context:", err));
  }, [profile?.id]);

  async function ask(promptOverride) {
    const message = promptOverride ? `${promptOverride}: ${input || "(no extra context)"}` : input;
    setLoading(true);
    setError("");
    setResponse("");
    setCandidateSteps([]);
    setAddedSteps({});
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context: profile
            ? {
                name: profile.name,
                pronoun: profile.pronoun,
                sun: profile.sun_sign,
                moon: profile.moon_sign,
                rising: profile.rising_sign,
                location: profile.birth_location,
                goals: profile.core_goals,
                natal_chart_notes: profile.natal_chart_notes,
                goals_progress: goalsProgress || undefined,
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Coach request failed (${res.status})`);
      }
      const data = await res.json();
      const reply = data.reply || "No response received.";
      setResponse(reply);
      setCandidateSteps(extractStepsFromReply(reply));
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function scriptify() {
    if (!input.trim()) return;
    setScriptLoading(true);
    setScriptError("");
    setScriptSaved(false);
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brainDump: input, profile }),
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(res.ok ? "Unreadable response." : `Server error (${res.status}): ${raw.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(data.error || "Couldn't generate the script.");
      await onContentSaved(input, data);
      setScriptSaved(true);
    } catch (err) {
      setScriptError(err.message || "Something went wrong.");
    } finally {
      setScriptLoading(false);
    }
  }

  async function handleTaskChange(next) {
    setTaskError("");
    try {
      await onSaveTasks(next);
    } catch (err) {
      console.error("Couldn't save micro-tasks:", err);
      setTaskError(err.message || "Couldn't save that — try again.");
    }
  }

  const tasks = blueprint?.micro_tasks || [];

  async function addSuggestedStep(step, index) {
    if (tasks.length >= 3) {
      setTaskError("Today's list is full (3/3) — clear one first.");
      return;
    }
    setTaskError("");
    const text = truncateForTaskList(step);
    await handleTaskChange([...tasks, { text, done: false }]);
    setAddedSteps((prev) => ({ ...prev, [index]: true }));
  }

  return (
    <div className="flex flex-col gap-6">
      {vibe && (
        <div className="text-sm text-clay border border-line rounded-full px-4 py-2 text-center">
          {vibe}
        </div>
      )}

      <section>
        <PrimaryAction value={input} onChange={setInput} onSubmit={() => ask()} loading={loading} />
        <QuickActions
          onPick={(p) => ask(p)}
          disabled={loading}
          onScriptify={scriptify}
          scriptDisabled={scriptLoading || !input.trim()}
        />
        {error && <p className="mt-4 text-sm text-fire">{error}</p>}
        <CoachResponse text={response} loading={loading} />

        {candidateSteps.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Add to today's list</span>
            {candidateSteps.map((step, i) => (
              <button
                key={i}
                type="button"
                disabled={addedSteps[i] || tasks.length >= 3}
                onClick={() => addSuggestedStep(step, i)}
                className="flex items-center gap-2 text-left text-sm px-3 py-1.5 rounded-full border border-line hover:border-clay text-muted hover:text-cream transition-colors disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted"
              >
                {addedSteps[i] ? <Check size={12} className="text-clay shrink-0" /> : <Plus size={12} className="shrink-0" />}
                <span className="truncate">{step}</span>
              </button>
            ))}
          </div>
        )}

        {scriptLoading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" />
            Turning that into a script…
          </div>
        )}
        {scriptError && <p className="mt-4 text-sm text-fire">{scriptError}</p>}
        {scriptSaved && (
          <div className="mt-4 flex items-center justify-between border border-clay rounded-xl px-4 py-3">
            <span className="text-sm text-cream flex items-center gap-2">
              <Check size={14} className="text-clay" />
              Saved to your content queue
            </span>
            <button
              type="button"
              onClick={onViewContent}
              className="text-xs text-clay flex items-center gap-1 hover:underline"
            >
              View <ArrowRight size={11} />
            </button>
          </div>
        )}
      </section>

      <section className="border-t border-line pt-6">
        <MicroTaskList tasks={tasks} onChange={handleTaskChange} />
        {taskError && <p className="mt-2 text-sm text-fire">{taskError}</p>}
      </section>
    </div>
  );
}
