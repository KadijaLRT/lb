import { useState } from "react";
import ContentCoach from "../components/ContentCoach.jsx";
import ContentEngine from "../components/ContentEngine.jsx";
import ContentQueue from "../components/ContentQueue.jsx";
import PostingCalendar from "../components/PostingCalendar.jsx";

export default function ContentEngineTab({ profile, onSaved }) {
  const [queueTick, setQueueTick] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Content Engine</p>
      <ContentCoach profile={profile} />
      <ContentEngine
        profile={profile}
        onSaved={async (dump, result) => {
          try {
            await onSaved?.(dump, result);
            setQueueTick((t) => t + 1);
          } catch (err) {
            console.error("Couldn't save to queue:", err);
          }
        }}
      />
      <ContentQueue profile={profile} refreshKey={queueTick} />
      <PostingCalendar />
    </div>
  );
}
