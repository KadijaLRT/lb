import { useState } from "react";
import { Calendar, ChevronDown, Info } from "lucide-react";

// General, widely-reported posting-time patterns from creator/marketing
// research — NOT personalized data, NOT live trend data (this app has no
// access to that), NOT a guarantee. Deliberately kept qualitative rather
// than falsely precise, since the exact "best" hour is genuinely contested
// across studies and shifts over time. Framed honestly in the UI: these
// are starting points, not certainties — your own account's real
// analytics (once you have some) will always beat generic guidance.
const PLATFORM_GUIDANCE = [
  {
    platform: "TikTok",
    color: "text-fire",
    bestDays: "Tuesday–Friday",
    windows: "Early morning (6–9am) or evening (7–11pm) local time",
    why: "Matches typical commute/wind-down scrolling windows — early enough to catch morning scrollers, late enough to catch the evening lull.",
  },
  {
    platform: "Instagram",
    color: "text-clay",
    bestDays: "Tuesday–Thursday",
    windows: "Late morning (11am–1pm) or evening (7–9pm) local time",
    why: "Lunch-break and post-work scroll windows tend to see more sustained attention than late-night or very early posts.",
  },
  {
    platform: "X",
    color: "text-earth",
    bestDays: "Weekdays, especially Tuesday–Thursday",
    windows: "Morning (8–10am) or lunch (12–1pm) local time",
    why: "X skews toward real-time/news-checking behavior — people check it in short bursts around work start and lunch, less so late at night.",
  },
  {
    platform: "Facebook",
    color: "text-water",
    bestDays: "Wednesday–Friday",
    windows: "Mid-morning to early afternoon (9am–1pm) local time",
    why: "Facebook's audience skews toward daytime/weekday browsing more than the other platforms here.",
  },
];

export default function PostingCalendar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-cream">
          <Calendar size={14} className="text-clay" />
          When to post
        </span>
        <ChevronDown size={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-line p-4 flex flex-col gap-3">
          <div className="flex items-start gap-2 text-xs text-muted italic">
            <Info size={13} className="shrink-0 mt-0.5" />
            General patterns from widely-reported creator research — not personalized to your account, not a guarantee, and not live trend data (nothing has access to that). Once you've posted enough to have real analytics, your own numbers beat any of this.
          </div>

          <div className="flex flex-col gap-3">
            {PLATFORM_GUIDANCE.map((p) => (
              <div key={p.platform} className="border border-line rounded-xl p-3 flex flex-col gap-1">
                <span className={`text-sm font-medium ${p.color}`}>{p.platform}</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-cream/90">
                  <span>
                    <span className="text-muted">Best days: </span>
                    {p.bestDays}
                  </span>
                  <span>
                    <span className="text-muted">Window: </span>
                    {p.windows}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">{p.why}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
