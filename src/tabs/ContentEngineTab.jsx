import { useState } from "react";
import ContentCoach from "../components/ContentCoach.jsx";
import ContentEngine from "../components/ContentEngine.jsx";
import ContentQueue from "../components/ContentQueue.jsx";

export default function ContentEngineTab({ profile, onSaved }) {
  const [queueTick, setQueueTick] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Content Engine</p>
      <ContentCoach profile={profile} />
      <ContentEngine
        profile={profile}
        onSaved={(dump, result) => {
          onSaved?.(dump, result);
          setQueueTick((t) => t + 1);
        }}
      />
      <ContentQueue profile={profile} refreshKey={queueTick} />
    </div>
  );
}
