import { useEffect, useState } from "react";
import { Calendar, ChevronDown, Info, Check, Circle } from "lucide-react";
import { listScripts, toggleScriptPlatformPosted } from "../lib/db.js";
import { localDateString } from "../lib/date.js";

// General, widely-reported posting-time patterns from creator/marketing
// research — NOT personalized data, NOT live trend data (this app has no
// access to that), NOT a guarantee. Deliberately kept qualitative rather
// than falsely precise, since the exact "best" hour is genuinely contested
// across studies and shifts over time. Framed honestly in the UI: these
// are starting points, not certainties — your own account's real
// analytics (once you have some) will always beat generic guidance.
const PLATFORM_GUIDANCE = [
  {
    key: "tiktok",
    platform: "TikTok",
    color: "text-fire",
    bestDays: "Tuesday–Friday",
    windows: "Early morning (6–9am) or evening (7–11pm) local time",
    why: "Matches typical commute/wind-down scrolling windows — early enough to catch morning scrollers, late enough to catch the evening lull.",
  },
  {
    key: "instagram",
    platform: "Instagram",
    color: "text-clay",
    bestDays: "Tuesday–Thursday",
    windows: "Late morning (11am–1pm) or evening (7–9pm) local time",
    why: "Lunch-break and post-work scroll windows tend to see more sustained attention than late-night or very early posts.",
  },
  {
    key: "x",
    platform: "X",
    color: "text-earth",
    bestDays: "Weekdays, especially Tuesday–Thursday",
    windows: "Morning (8–10am) or lunch (12–1pm) local time",
    why: "X skews toward real-time/news-checking behavior — people check it in short bursts around work start and lunch, less so late at night.",
  },
  {
    key: "facebook",
    platform: "Facebook",
    color: "text-water",
    bestDays: "Wednesday–Friday",
    windows: "Mid-morning to early afternoon (9am–1pm) local time",
    why: "Facebook's audience skews toward daytime/weekday browsing more than the other platforms here.",
  },
];

// Which content field a script actually has for each platform — used to
// decide whether a piece even needs a checkbox for that platform at all.
const CONTENT_FIELD = {
  tiktok: "short_form_script",
  instagram: "instagram_caption",
  x: "x_thread",
  facebook: "facebook_post",
};

export default function PostingCalendar({ profile, refreshKey }) {
  const [open, setOpen] = useState(false);
  const [scripts, setScripts] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null); // `${scriptId}-${platformKey}` while a toggle is in flight

  useEffect(() => {
    if (!open || !profile?.id) return;
    listScripts(profile.id, 30)
      .then(setScripts)
      .catch((err) => {
        console.error(err);
        setError("Couldn't load your content.");
      });
  }, [open, profile?.id, refreshKey]);

  async function togglePosted(script, platformKey) {
    const busyKey = `${script.id}-${platformKey}`;
    setBusy(busyKey);
    setError("");
    try {
      const updated = await toggleScriptPlatformPosted(script.id, platformKey, script.posted_at, localDateString());
      setScripts((prev) => prev.map((s) => (s.id === script.id ? updated : s)));
    } catch (err) {
      console.error(err);
      setError("Couldn't update that — try again.");
    } finally {
      setBusy(null);
    }
  }

  // Only counts platforms that actually have content generated for them —
  // a piece with no Facebook post shouldn't count against it as "unposted
  // on Facebook."
  function platformsFor(script) {
    return PLATFORM_GUIDANCE.filter((p) => script[CONTENT_FIELD[p.key]]?.trim());
  }

  const withContent = (scripts || []).filter((s) => platformsFor(s).length > 0);
  const unposted = withContent.filter((s) => platformsFor(s).some((p) => !s.posted_at?.[p.key]));
  const fullyPosted = withContent.filter((s) => platformsFor(s).every((p) => s.posted_at?.[p.key]));

  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-cream">
          <Calendar size={14} className="text-clay" />
          Posting tracker & when to post
        </span>
        <ChevronDown size={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-line p-4 flex flex-col gap-5">
          {error && <p className="text-sm text-fire">{error}</p>}

          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              Still to post {unposted.length > 0 && `(${unposted.length})`}
            </span>
            {scripts === null && <p className="text-sm text-muted">Loading…</p>}
            {scripts !== null && unposted.length === 0 && (
              <p className="text-sm text-muted italic">Nothing pending — everything you've generated is fully posted.</p>
            )}
            {unposted.map((s) => (
              <div key={s.id} className="border border-line rounded-xl p-3 flex flex-col gap-2">
                <p className="text-sm text-cream">{s.raw_brain_dump || "(no source text)"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {platformsFor(s).map((p) => {
                    const isPosted = !!s.posted_at?.[p.key];
                    const isBusy = busy === `${s.id}-${p.key}`;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        disabled={isBusy}
                        onClick={() => togglePosted(s, p.key)}
                        className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                          isPosted ? "border-earth text-earth" : "border-line text-muted hover:border-clay hover:text-cream"
                        }`}
                      >
                        {isPosted ? <Check size={11} /> : <Circle size={11} />}
                        {p.platform}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {fullyPosted.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Posted ({fullyPosted.length})</span>
              <div className="flex flex-col gap-1.5">
                {fullyPosted.map((s) => (
                  <div key={s.id} className="flex items-start justify-between gap-2 text-xs text-muted">
                    <span className="flex-1">{s.raw_brain_dump || "(no source text)"}</span>
                    <span className="flex gap-1 shrink-0 pt-0.5">
                      {platformsFor(s).map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => togglePosted(s, p.key)}
                          title={`Posted to ${p.platform} on ${s.posted_at[p.key]} — tap to undo`}
                          className={`${p.color} hover:opacity-60 transition-opacity`}
                        >
                          <Check size={12} />
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-line flex flex-col gap-3">
            <div className="flex items-start gap-2 text-xs text-muted italic">
              <Info size={13} className="shrink-0 mt-0.5" />
              General patterns from widely-reported creator research — not personalized to your account, not a guarantee, and not live trend data (nothing has access to that). Once you've posted enough to have real analytics, your own numbers beat any of this.
            </div>

            <div className="flex flex-col gap-3">
              {PLATFORM_GUIDANCE.map((p) => (
                <div key={p.key} className="border border-line rounded-xl p-3 flex flex-col gap-1">
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
        </div>
      )}
    </div>
  );
}
