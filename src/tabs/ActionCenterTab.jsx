import { useEffect, useState } from "react";
import PrimaryAction from "../components/PrimaryAction.jsx";
import QuickActions from "../components/QuickActions.jsx";
import CoachResponse from "../components/CoachResponse.jsx";
import MicroTaskList from "../components/MicroTaskList.jsx";

export default function ActionCenterTab({ profile, blueprint, onSaveTasks }) {
  const [vibe, setVibe] = useState("");
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [taskError, setTaskError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (profile?.sun_sign) params.set("sun", profile.sun_sign);
    if (profile?.moon_sign) params.set("moon", profile.moon_sign);
    if (profile?.rising_sign) params.set("rising", profile.rising_sign);
    fetch(`/api/transits?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setVibe(d.vibe || ""))
      .catch(() => setVibe(""));
  }, [profile?.sun_sign, profile?.moon_sign, profile?.rising_sign]);

  async function ask(promptOverride) {
    const message = promptOverride ? `${promptOverride}: ${input || "(no extra context)"}` : input;
    setLoading(true);
    setError("");
    setResponse("");
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
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Coach request failed (${res.status})`);
      }
      const data = await res.json();
      setResponse(data.reply || "No response received.");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
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

  return (
    <div className="flex flex-col gap-6">
      {vibe && (
        <div className="text-sm text-clay border border-line rounded-full px-4 py-2 text-center">
          {vibe}
        </div>
      )}

      <section>
        <PrimaryAction value={input} onChange={setInput} onSubmit={() => ask()} loading={loading} />
        <QuickActions onPick={(p) => ask(p)} disabled={loading} />
        {error && <p className="mt-4 text-sm text-fire">{error}</p>}
        <CoachResponse text={response} loading={loading} />
      </section>

      <section className="border-t border-line pt-6">
        <MicroTaskList tasks={tasks} onChange={handleTaskChange} />
        {taskError && <p className="mt-2 text-sm text-fire">{taskError}</p>}
      </section>
    </div>
  );
}
