import { useState } from "react";
import { Mic, ListChecks, CalendarDays } from "lucide-react";
import SubTabBar from "../components/SubTabBar.jsx";
import ContentCoach from "../components/ContentCoach.jsx";
import ContentEngine from "../components/ContentEngine.jsx";
import ContentQueue from "../components/ContentQueue.jsx";
import PostingCalendar from "../components/PostingCalendar.jsx";

const SUB_TABS = [
  { key: "create", label: "Create", icon: Mic },
  { key: "queue", label: "Queue", icon: ListChecks },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
];

export default function ContentEngineTab({ profile, onSaved }) {
  const [subTab, setSubTab] = useState("create");
  const [queueTick, setQueueTick] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === "create" && (
        <div className="flex flex-col gap-6">
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
        </div>
      )}

      {subTab === "queue" && <ContentQueue profile={profile} refreshKey={queueTick} />}

      {subTab === "calendar" && <PostingCalendar profile={profile} refreshKey={queueTick} />}
    </div>
  );
}
