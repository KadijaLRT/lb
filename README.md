# Kadija — Life Blueprint (Phase 1 MVP)

## Fixed real content fabrication, not a tone issue
Your screenshot showed exactly what was wrong: you typed one sentence ("I
deserve the most romantic man in the world"), and the generated script
invented an entire specific wishlist you never said — love notes,
flowers, "ranting about my day," "no games." That's not a voice problem,
it's the model padding a short input to hit a word count by manufacturing
specifics that aren't yours.

Root cause: nothing in `content.js`'s prompt ever said the content had to
stay grounded in what was actually written — there was a 130-word slot to
fill and a one-line brain dump to work from, so it filled the gap.

Added the actual missing rule, using this exact example directly in the
prompt so it's unmistakable: never invent specific details, scenarios, or
backstory not present in the source text. If the brain dump is short, the
output should stay short too — a confident 15-word hook that's genuinely
theirs beats 100 words of invented specifics. Also explicit now: only use
a detail if the person actually stated it or it's a direct restatement of
what they said, never a "plausible-sounding" invention.

## Coach voice tightened further — structural fixes, not just more rules
Couldn't test live output in this environment (no API access here), so
diagnosed from the prompt itself and fixed three concrete mechanisms
rather than adding another abstract "sound more natural" instruction:

- **Context was being handed to the model as raw JSON** —
  `{"name":"K","voice_sample":"...",...}`. That's an inherently
  machine-shaped signal, not "here's how a person talks." Rewrote it into
  plain sentences ("Their name is K... here's a real sample of how they
  write, match this voice closely: ...") — same information, but framed
  as instructions to a person instead of data to parse.
- **Named the actual robotic tics, not just banned phrases**: restating
  what the person just said back to them before responding, hedge-openers
  ("I think maybe..."), bow-tied summary closers ("Overall, the key
  is..."), narrating helpfulness ("Here's what I'd suggest..." / "I hope
  this helps!"). These patterns are what make AI replies read as AI
  replies more than any individual word choice, and the old prompt never
  called them out directly.
- **Added a concrete before/after example** contrasting a robotic reply
  against a real one for the same message, so there's an actual model to
  match rather than only abstract rules to follow.
- Bumped temperature 0.7 → 0.8 — low temperature is part of why model
  output converges on safe, average phrasing; a bit more randomness helps
  now that the structural guardrails (topic, jargon, length) are doing
  more of the real work.

## Removed all text truncation app-wide, not just the one spot
Full sweep: every place text was cut off, in any form, anywhere in the
app.
- **Goal titles** (`GoalsTracker.jsx`, both the import-preview and the
  regular goal card) — removed `truncate`, adjusted the goal-card icon
  row to `items-start` so a wrapped multi-line title doesn't misalign.
- **Job application role/company/salary** (`JobApplicationTracker.jsx`) —
  removed `truncate` from both lines.
- **Suggested micro-task step chips** (`ActionCenterTab.jsx`) — removed
  `truncate`, adjusted the pill shape (`rounded-full` → `rounded-2xl`) and
  icon alignment so multi-line suggestions display cleanly.
- **Saved micro-task text itself** — this was actually the biggest one:
  `truncateForTaskList()` was shortening step text *before saving* to your
  daily checklist, not just a display clip. Removed that call entirely —
  full text now saved and shown, no exception left for this one. The
  now-fully-unused `truncateAtWord`/`truncateForTaskList` helpers were
  removed from `extractSteps.js`.
- Confirmed the earlier `ContentQueue.jsx`/`PostingCalendar.jsx` fixes
  hold, and re-swept the whole `src/` tree for any remaining
  `truncate`/`line-clamp` classes or display-text `.slice(0, N)` calls —
  zero remain. (Two harmless non-matches: an array `.slice(0, 5)` limiting
  suggestion *count*, and `.slice(0, -1)` popping the last chat message on
  error — neither truncates text content.)
- Scrollable containers (`max-h-* overflow-y-auto` on transaction lists,
  chat history, the queue, the settings modal) were left as-is — those
  scroll rather than clip, no text is ever hidden or lost, just contained
  in a panel you scroll through.

## Removed truncation entirely, per direct feedback
Last round's word-boundary fix wasn't what was wanted — no cutting at all.
Reverted all three spots to show the complete `raw_brain_dump` text with
no truncation. Also removed CSS-based clamping (`line-clamp-2` and
`truncate`) that was quietly doing the same cutting visually even after
the JS-level fix — a JS truncation fix alone wouldn't have been enough,
since Tailwind's `line-clamp`/`truncate` classes clip independently of
whatever text is actually passed in. The posted-items row now wraps to
multiple lines instead of forcing single-line ellipsis, with the
platform checkmarks staying aligned to the top of the row.

## Mid-word text truncation bug fixed (3 places)
Real bug from your screenshot: queue item previews used plain
`.slice(0, 80)` with no word-boundary awareness, so long text got hard-cut
mid-word with no ellipsis ("...we talked it ou"). Generalized the
word-boundary truncator that already existed for micro-tasks
(`truncateForTaskList` → `truncateAtWord`, reusable now) and applied it to
all three places this bug existed: the queue list preview, and two spots
in the posting tracker (pending and posted lists). Verified against the
exact text from the screenshot — now cuts at "...we talked it…" instead of
"...we talked it ou". Swept the rest of the codebase for the same
`.slice(0, N)` pattern — remaining instances are all truncating raw error
text for debug messages, not user-facing content, so left alone.

## Found the real cause of the "talking to a robot" feeling — voice sample wasn't wired to the coach
The voice-sample mechanism already existed (built for Content when you
gave me your Twitter link) but only ever reached Content generation —
the main coach, which is what most of the app's conversation actually
runs through, never received it at all. That's the real gap, not
anything about dialect or phrasing rules.

- Added an explicit "match this closely, it's the single most important
  signal" instruction to `coach.js`'s system prompt.
- Wired `voice_sample` into the main coach context in `ActionCenterTab.jsx`
  (every quick-action prompt, every typed message, "Turn into script" all
  route through this) and `ImpulsePause.jsx`'s check-in — both were
  missing it entirely.
- Relabeled the Settings field so it's clear it drives the whole app, not
  just generated content, and moved it up to "About you" since it's no
  longer content-specific.

Didn't build a "sound more Black/AAVE" feature by pattern-matching social
media — that would mean generating a generic dialect performance from
strangers' posts rather than actually sounding like *you*, and flattens
real speech into a stereotype. The paste-your-own-writing mechanism is the
honest fix: it makes the coach match your specific, actual voice, which is
also just a better fix in general, not only for this concern.

## Full "Once-and-Done" + "Continuous" bug checklist audit
Went through both categories from the standard release-gate/regression
checklist against the actual codebase.

**Fixed:**
- **Stale `.env.example` docs** — referenced `/api/plaid/*` and
  `astrocartography.js`, both deleted months ago. Fixed the comments.
- **Race condition, `AstroSnapshot.jsx`**: refetches on every
  `natalChartNotes` change with no cancellation guard. Since `transits.js`
  now calls Groq (variable latency, no longer instant), two rapid Settings
  edits could resolve out of order and show stale data. Added a proper
  `cancelled` flag with cleanup.

**Checked and confirmed NOT a bug (with the actual reasoning, not just "seems fine"):**
- **Hardcoded credentials**: none in client code — verified `GROQ_API_KEY`/
  `SUPABASE_SERVICE_ROLE_KEY` never appear in `src/`.
- **BOLA (Broken Object-Level Authorization)**: real gap technically —
  RLS policies are `using (true)` (allow-all) and queries don't filter by
  `user_id`. But this is a deliberately single-user, no-login app (already
  documented at the top of `schema.sql`) — there's no second user to
  exploit it against. Real risk only if the URL is ever shared/discovered;
  worth remembering if this ever becomes multi-user.
- **Session/token expiry**: no auth session exists to expire, consistent
  with the single-user design.
- **Dark mode**: no system dark-mode toggle handling exists — one fixed
  palette always. Not "broken," just not responsive to the OS setting.
- **Font scaling**: no fixed-height containers holding user-facing text;
  the only fixed-size elements are icon-only buttons (SVGs don't reflow
  with text-size preferences).
- **Zero-state / FTUE**: `getOrCreateProfile()` and `getPrimaryAccount()`
  both auto-provision on first load — a brand-new user never actually
  hits a null profile/account for long.
- **Infinite loading loops**: scanned every `setLoading(true)` — all have
  a guaranteed `finally` or `.finally()` reset path.
- **Background data wipe**: every text input is a properly controlled
  React component (state-backed, not DOM-reliant) — verified no
  value-without-onChange inputs exist.
- **NPE risk**: spot-checked direct `profile.field` access patterns —
  all are inside conditional guards one line up or an early-return check.

## Content tab fully collapsible + posted/unposted tracking integrated into the calendar
- **`ContentCoach.jsx`** now collapses like every other section on the
  page (was the one exception, always fully expanded).
- **`ContentEngine.jsx`'s main brain-dump input stays expanded** on
  purpose — it's the primary action of the whole tab, collapsing it would
  hide the actual point of the page. Its own idea-generator sub-panel
  already collapses.
- **New: `posted_at` per-platform tracking** on `scripts_and_ideas` —
  jsonb map like `{"tiktok": "2026-09-02", "x": null}`, since one piece
  might be posted to TikTok and still sitting as a draft on X. Run the
  schema migration.
- **Rebuilt `PostingCalendar.jsx`** into a real posted/unposted tracker,
  not a separate reference panel: fetches your actual saved content, shows
  "Still to post" (with tap-to-mark-posted buttons per platform — only for
  platforms that actually have content generated) and "Posted" as two
  distinct sections, directly above the same honest posting-time guidance
  from before. Only counts a platform against a piece if content actually
  exists for it — a script with no Facebook post generated doesn't count
  as "unposted on Facebook."
- Verified the grouping and toggle logic directly: partial-platform
  posting (2 of 4 platforms have content, 1 posted) correctly sorts into
  "still to post," and toggling one platform's posted state never touches
  another platform's.

## Full UX/UI audit — Action, Content, Finance, Blueprint (18 real bugs found and fixed)
Went through every component in all four tabs. Grouped by what kind of bug:

**Silently-failing saves (the most serious class — 4 found):**
`useKadijaData.js`'s `setMicroTasks`, `setFocus`, and `saveProfileFields`,
plus `App.jsx`'s `handleScriptSaved` and `handleLogExpense`, all had
`if (!profile) return;` (or `if (!account) return;`) with no error thrown.
Every caller wraps these in try/catch expecting a real failure to surface
— so if the action fired before the profile/account finished loading, the
UI would show "Saved!" / close the modal / clear the input, while nothing
was actually written. Fixed all 5 to throw a real, catchable error instead.

**Touch-invisible UI (2 found):** the micro-task delete button and the
idea generator's "Use this →" cue were both `opacity-0 group-hover` — a
pattern that has no equivalent on touch devices, making them permanently
invisible on the phone this app is built for. Removed the hover-gating.

**Stale state bleeding across contexts (3 found, one serious):**
switching Go Deeper areas didn't clear the follow-up chat's messages —
Career's conversation could stay visibly on screen after switching to
Love until new data loaded. Same bug in scenario-advice chat between
different questions. Also: coach and script-generation state on Action
Center didn't reset when switching between the two independent flows,
so a stale "saved to queue" banner could linger over a fresh coach answer.

**Dead-end error states (1 found):** Spending Trend's fetch error
permanently replaced the whole component with just error text — no retry,
no recovery short of a full reload. Added a retry button.

**Form/edit conflicts (2 found):** Goals Tracker's "Add goal" and "Edit
goal" forms could both be open simultaneously; deleting a goal or content-
queue item mid-edit left orphaned edit-state pointing at nothing.

**Missing error handling (1 found):** Impulse Pause's coach call had zero
error handling — a failed request just silently stopped loading with
nothing shown, and reopening didn't clear the previous question.

**Minor state hygiene (5 found):** Expense modal's error/category
persisting across opens; race condition letting the primary input and
script button fire overlapping requests; a defensive fix for a
divide-by-zero edge case in the safe-to-spend bar.

All fixes verified with a clean production build.

## Content: algorithm signals, per-platform steps, de-goal-ified ideas, posting calendar
Several fixes and one new feature, all in the Content tab:

- **Couldn't read your X account** — tried both direct fetch and search; X
  blocks scraping entirely for logged-out access, confirmed rather than
  guessed. Added a real fix instead of giving up: a "Voice sample" field
  in Settings (paste a few of your own past posts) that both `content.js`
  and `content-ideas.js` now weight heavily when generating anything.
- **Found the actual cause of goal-centric ideas**: with no brain dump to
  work from, your goals were the *only* substantive context the idea
  generator had, so it leaned on them for all 5 suggestions every time.
  Fixed with a hard numeric cap — at most 1 of 5 ideas may touch your
  goals now, not just softer wording asking it to be "relevant." Same fix
  applied to `ContentCoach.jsx`, which was doing the same thing (that's
  what produced the "Stuck on the next piece?" screenshot).
- **Execution steps are now genuinely per-platform** — used to be one
  shared checklist for all 4 platforms even though TikTok (filming),
  Instagram (caption + cover frame + Stories), X (timing + reply
  mechanics), and Facebook (Groups + comment-seeding) all work completely
  differently. Steps now live under the platform tab they actually apply
  to. Old saved queue items with the previous shared-list format still
  display correctly (verified directly).
- **New: real algorithm-signal breakdown**, not hype. Every generated
  piece now gets 3 honest notes — Retention (does the hook actually hold),
  Shareability (is there a specific save/send-worthy line), Comments (does
  anything genuinely invite a reply) — tied to well-documented platform
  mechanics, explicitly told never to claim or imply guaranteed virality.
- **New: hook variants** — 2 real alternate opening lines per script to
  A/B test, not just a reworded version of the same hook.
- **New: "When to post" calendar** in Content tab — general, honestly-
  framed posting-window guidance per platform from widely-reported
  creator research. Explicitly labeled as NOT personalized, NOT live
  trend data (nothing here has access to that), and NOT a guarantee —
  your own account's real analytics beat this once you have them.

## Three fixes: coach tone, content framing, queue expansion
- **Coach now adapts tone to topic**, instead of one flat register for
  everything. Venting/struggle gets a slower, validating beat before
  advice; quick logistics skip that entirely and get straight to it;
  money questions stay direct and plain; content brainstorming gets more
  energy and personality; good news actually sounds glad instead of
  landing in the same even register as everything else.
- **Content no longer forced into problem→solution shape.** `content.js`
  now explicitly says: if the brain dump is a reflection, an opinion, or
  just a topic worth talking about — including something personal that
  affects you — let the content be that. No manufactured struggle-then-fix
  arc bolted onto something that's just a real thought.
- **Queue items now reopen with everything, not just the main script.**
  Real bug: `instagram_caption`, `x_thread`, `facebook_post`,
  `execution_steps`, and `engagement_tip` were already being saved to the
  database every time — just never displayed again. Reopening a queued
  idea only ever showed the TikTok/Reels script. Rebuilt `ContentQueue.jsx`
  with the same 4-platform tabbed view as the main generator, plus the
  engagement tip and step list, each platform with its own copy button.

## Content section tone fixed
The actual generated content (scripts, captions, posts, idea hooks) had no
voice guidance beyond format rules — the prompts framed everything as a
"content repurposing engine" and "content strategist... optimizing for
engagement," which is corporate-marketer language, and with nothing
telling the OUTPUT itself to sound like a real person, it defaulted to
generic AI-content patterns.

Rewrote both `content.js` and `content-ideas.js`:
- Dropped the "engine"/"strategist" self-framing — reframed as helping a
  friend, not running a content operation.
- Added explicit voice rules for the generated content itself, not just
  the coaching notes around it: no "Let's dive in," no "Here's the thing,"
  no stacked exclamation points, no generic CTAs ("Drop a comment below!"),
  no hollow hype — write it the way the person would actually say it out
  loud.
- Same fix applied to idea-generator hooks specifically, since those were
  reading like marketing-template angles rather than real thoughts someone
  had.

## X content: already fixed in code (stale deploy), but found a real save bug
The numbered "1/2/3" thread format in your screenshot doesn't exist in the
current code — `content.js` already specifies `x_post` as a single tweet
(not numbered, minimum 140 characters), and `ContentEngine.jsx` already
renders it as one plain paragraph with a character counter under an "X
Post" tab, not "X Thread." That's a stale-deployment situation — push and
redeploy the latest zip and it should match.

**Did find a real bug while checking this, though**: `App.jsx`'s save-to-
queue logic was still reading `result.x_thread` — a field that no longer
exists now that the backend returns `x_post` instead. That expression
always evaluated to an empty string, so anything saved to your queue would
have had a blank X post forever, silently, regardless of what displayed on
screen before saving. Fixed to store `result.x_post` correctly. Kept the
same `x_thread` database column name (no schema change needed) — just
fixed what actually gets written into it.

## Advice section retuned to actually sound like advice, not a shorter report
Fair distinction: the "Get advice" scenario feature is fundamentally
different from the daily readings — you're telling it something and
asking what to do, so it should feel like a friend texting back, not an
analysis with the word count trimmed. The previous fix cut the repetitive
aspect-listing problem but left instructions like "address their situation
head-on in the first sentence," which still reads like a memo opening, not
a reaction.

Rewrote `buildScenarioPrompt` specifically (daily readings in
`buildStandardPrompt` are untouched — that one's meant to read a bit more
like "here's what's happening," this one's a two-way exchange):
- Told explicitly to react like a person first — acknowledge what was
  shared before jumping to the chart, the way an actual friend would.
- Astrology now framed as something that "occurred to you mid-conversation"
  rather than delivered analysis — "and honestly, Saturn's doing this right
  now, so..." instead of "the relevant aspect is..."
- Timing/trend guidance (still building vs. already past its peak) kept,
  but rephrased conversationally instead of as a formal breakdown.
- Framed explicitly as "a text back, not an essay."

## Real fix for the mechanical, repetitive "listed every aspect" problem
Your screenshot showed the actual bug clearly: 6 separate aspects, each
getting its own sentence with the same repeated flowery template
("Venus's gentle link," "Jupiter's bright boost," "Saturn's gentle hand,"
"Neptune's soft kiss," "Pluto's pull") — and it ran to ~300 words despite a
"130 word" instruction. Root cause was a **data** problem, not just a
prompt-wording one: the code was handing the model 6 transit aspects plus
an *uncapped* list of natal aspects and saying "use these" — no amount of
"be concise" instruction reliably overrides being handed 8+ facts to work
through.

Fixed in all three places (`astrology.js`'s daily readings, its scenario
advice — the exact path in your screenshot, and `astrology-chat.js`'s
follow-up chat):
- **Aspect counts cut hard**: transit aspects from 6 (8 in chat) down to 3;
  natal aspects from uncapped down to 2, now actually sorted by real orb
  (tightest/most exact first) instead of arbitrary order.
- **Explicit ban on the mechanical list pattern**: "DO NOT work through
  every aspect given, one sentence each" — told to pick the single most
  relevant one and build around it, using a second only if it changes
  something.
- **Explicit ban on the flowery repeated-metaphor problem**: named the
  actual pattern from your screenshot ("gentle hand," "soft kiss," "bright
  boost") as exactly what not to do.
- **Word limit tightened**: 200→130 words for both daily and scenario
  readings, since a shorter data set makes a shorter response actually
  achievable now instead of fighting against 8 facts crammed in.

Verified the actual data assembly directly: a realistic love-area scenario
now sends 3 aspects to the model, down from 6+uncapped before.

## "Today's vibe" fully rebuilt, Full Chart Reading removed
**Vibe rebuild**: the personalized text was always built by string-templating
planet names into fixed sentence shapes ("X is [verb]-ing your Y") — that's
structurally why it kept sounding mechanical and repetitive no matter how
many times the templates got patched. Deleted that approach entirely.
Now `transits.js` computes ONE real fact (the single tightest
transit-to-natal aspect, not two stacked together) and hands it to the same
natural-language generation the rest of the app already uses (Groq,
`reasoning_effort: low`, same plain-language/no-jargon voice as the coach
and Go Deeper readings) — genuinely varied phrasing instead of a filled-in
template, and explicitly told not to mechanically list raw positions.

**Caught a real bug while testing this**: when the AI generation step
itself fails (network hiccup, API issue), the fallback message was
incorrectly blaming your chart format ("couldn't be read") even when
parsing had succeeded fine — two different failure modes were conflated
into one message. Fixed to distinguish three states properly: no chart
data, chart data that couldn't be parsed, and chart data that parsed fine
but the generation step failed. Verified all three produce the correct,
distinct message.

**Full Chart Reading removed entirely** — `api/full-chart.js`,
`FullChartReading.jsx`, and its DB helpers are deleted. Blueprint layout is
now Astro Snapshot → Core Goals → Goal Progress → Go Deeper. The
`full_chart_readings` table stays in the database (harmless, no destructive
migration) but nothing references it anymore.

## Action Center vibe actually behaves live now, not just computed differently once
Real gap: both banners only ever fetched once per mount — the previous fix
made Action Center's *computation* live (no date pinning server-side), but
in normal use that's invisible, since neither banner would visibly change
without a full reload. "Live" needs to mean it actually updates while
you're using the app.

Fixed: `ActionCenterTab.jsx` now refetches every 5 minutes on a timer
while the tab stays open, on top of already refetching fresh every time
you switch back to the Action tab (it unmounts/remounts on tab switches,
so that was already happening). Cleans up the interval properly on
unmount so it doesn't keep running in the background across other tabs.

## Split: Blueprint stays stable, Action Center goes back to live
Per request — the daily-snapshot fix from last round was correct for
Blueprint's AstroSnapshot, but Action Center's vibe banner was meant to
stay live/real-time. Reverted just that one call site:
- **`AstroSnapshot.jsx` (Blueprint tab)**: still sends `for_date`, still
  pinned to noon UTC of the day, still stable across repeated opens —
  unchanged from last round.
- **`ActionCenterTab.jsx` (Action Center)**: no longer sends `for_date`,
  so the backend falls through to its live-clock path — recomputes fresh
  from the actual current moment every time, as originally intended for
  this specific banner.

Verified both paths directly: two Blueprint-style calls for the same date
produce identical output (stable, correct), while an Action-Center-style
call with no date correctly falls through to the live computation path.

## "Today's vibe" was flickering — fixed the actual architecture bug
Real bug, not a display issue: the endpoint computed planetary positions
from the literal live moment (`new Date()`) on every single request, with
no caching. Since planets move continuously, checking at 9:54 and again at
10:15 on the same day could genuinely produce different "tightest aspect"
results — sometimes different enough to change the whole sentence, not
just wording. "Today's vibe" should be a stable daily snapshot (like a
weather forecast computed once for the day), not something recalculated
fresh every time you open the app.

Fixed by pinning the computation to noon UTC of the client's actual local
calendar date instead of the live moment — the frontend now sends its
local date (`localDateString()`) with every request, both in
`AstroSnapshot.jsx` and `ActionCenterTab.jsx`'s vibe banner.

**Verified directly, not just reasoned about**: called the endpoint 5
times for the same date with simulated real-world delays between calls —
all 5 produced byte-identical output. Then called it for two different
dates and confirmed the content correctly differs across days. Both
behaviors now match what "today's vibe" should actually mean.

## Screenshot upload removed — copy/paste only now
Removed entirely: `api/parse-natal-screenshots.js` (deleted), the upload
button/file input/related state in `SettingsModal.jsx`, and the leftover
"or upload screenshots" wording in `full-chart.js`'s error message. The
live chart-parsing preview under the natal chart notes field (added last
round) still works exactly the same for paste — that was never
upload-specific, it fires on any text change. No functionality lost for
the paste path; upload path is just gone. Verified no dangling references
remain anywhere in the codebase, clean build, bundle size dropped slightly
as expected.

## Three real parsing bugs found and fixed — your exact chart text tested
Your live preview did exactly its job: it showed 0/0/0 because the parser
genuinely couldn't read your pasted format. Reproduced the exact failure
with your real text first, then fixed each root cause:

1. **Longitudes**: `13°54' Leo` has an apostrophe (arcminute mark) sitting
   directly before the sign name — the regex required whitespace
   immediately after the minutes digits, so the apostrophe broke every
   single match. Now tolerates an optional `'`/`′` there.
2. **Houses**: your format writes `(XI House)` and even `(Retrograde, VI
   House)` — the old regex required the parentheses to contain *nothing
   but* the roman numeral. Rewrote to search a bounded window near each
   planet's name for a valid roman numeral token instead of requiring an
   exact parenthetical match — handles "in XI", "(XI)", "(XI House)", and
   "(Retrograde, VI House)" all at once.
3. **Aspects**: your format gives real orb degrees — `(Orb 9°37')` — which
   is genuinely better data than the arbitrary score the old parser
   expected (`(43)`). Now handles both, extracting actual orb-in-degrees
   when given.

**Verified against your complete, real pasted text — not a sample**: 14 of
14 points (10 planets + Lilith/Nodes/Fortune), 12 of 12 house placements,
27 of 27 aspects, all with real orb degrees now attached. Also confirmed
the previously-working format still parses correctly — no regression.

## Live chart-parsing preview + removed orphaned fields
Two fixes from your report:

- **New live preview under the natal chart notes field in Settings**:
  updates as you type/paste/upload, showing exactly what's being detected
  — "Reading this correctly: 10 of 10 planets, 12 house placements, 27
  aspects detected" in clay, or a clear red warning if 0 planets parsed
  ("check the format"), or a neutral note if the field's empty. This
  directly answers "is my paste/upload actually working" without needing
  to save, leave Settings, and check the vibe card to find out — the
  single biggest diagnostic gap in the upload/paste flow before this.
- **`birth_lat` and `birth_lng` removed from Settings** — audited every
  field and found these two were being collected and saved but consumed
  by literally nothing, since astrocartography (their only purpose) was
  removed earlier. Exactly the kind of disconnect you asked me to check
  for. The database columns stay (harmless, no destructive migration), just
  the dead UI is gone.
- **Better diagnostics in `transits.js`**: the "Today's vibe" fallback
  message now distinguishes "you haven't added a chart yet" from "your
  chart is saved but couldn't be read" — previously both cases showed the
  identical generic message, which is exactly what made this bug
  invisible to debug from the screenshot alone.
- Verified: `_ephemeris.js`'s parsers now import cleanly into the frontend
  (confirms it's genuinely dependency-free, as designed) and the preview
  logic tested correctly against empty, garbage, and valid chart text.

## Full audit: every Settings field, what it's wired to
- **name** → header display, coach context
- **pronoun** → coach context (instructed to use it naturally)
- **birth_date, birth_time, birth_utc_offset** → Full Chart Reading's real
  computed Saturn/Jupiter return dates
- **birth_location** → coach context (available, lightly used)
- **weekly_budget** → synced to `financial_accounts.weekly_spend_limit`,
  what the Finance tab actually displays
- **core_goals** → coach context, Job Application tracker's salary-goal
  note, Goals Tracker's "Import from Core Goals," content generation context
- **natal_chart_notes** → everything astrology: daily readings, Full Chart
  Reading, follow-up chat, Today's Vibe, auto-derived Sun/Moon/Rising

Nothing left unaccounted for.

## Nothing from your chart is dropped anymore — full audit and fix
You were right that a lot was being silently left out. Audited everything
your chart notes actually contain versus what was being parsed:

- **Your 27 natal aspects (Sun conjunct Moon, Venus trine Uranus, etc.) —
  100% unused before this.** New `parseNatalAspects()` extracts the whole
  list. Verified: all 27 of 27 parse correctly from your exact chart text.
  These describe permanent personality wiring, distinct from daily transit
  aspects — now fed into every reading (daily areas, Full Chart, follow-up
  chat), with the prompt explicitly told which is which so it doesn't
  conflate "core wiring" with "today's weather."
- **Lilith, North/South Node, Part of Fortune — previously not parsed at
  all** since they're not part of the 10-body list used for transit
  computation (no real orbital formula exists for those points here).
  Added a separate `EXTRA_NATAL_POINTS` list used ONLY for parsing your
  chart text (never for computing where anything is "today" — that
  distinction matters, since faking transit positions for points we can't
  actually compute would be worse than leaving them out). Verified: all 14
  points (10 planets + 4 extras) parse correctly, all 12 house placements
  parse correctly.
- Every prompt updated with an explicit "use everything given, don't
  substitute a generic assumption when real data exists" rule.
- Verified all three endpoints (`astrology.js`, `full-chart.js`,
  `astrology-chat.js`) execute cleanly end-to-end with the fully-loaded
  chart data — no crashes anywhere in the pipeline.

## Real gap found and fixed: house placements were parsed nowhere
Your chart notes have always contained house placements (Sun in XI, Venus
in XII, etc.) and it turned out nothing was ever extracting them — every
reading referenced houses only generically ("the 10th house means career")
without knowing this chart's Sun isn't even in the 10th house. Fixed:

- New `parseHousePlacements()` in `_ephemeris.js` — supports both "Sun in
  XI" and "Sun: Leo 13°54' (XI)" formats. Verified against your real data
  in both formats: correctly extracts Sun/Moon/Mercury→XI, Venus→XII,
  Mars→IX, Jupiter/Pluto→II, Saturn/Uranus/Neptune→VI/IV/IV.
- Wired into all three places natal data gets used: the daily area
  readings (`astrology.js`), the Full Chart Reading (`full-chart.js`), and
  follow-up chat grounding (`astrology-chat.js`) — each now gets real house
  data and is explicitly instructed to use it instead of defaulting to
  textbook house-sign assumptions.
- Verified the full pipeline end-to-end with real house-annotated chart
  data — no crashes, reaches the API cleanly.

## "Today's vibe" is now a real comparison, not one isolated fact
Previous version picked only the single tightest aspect and said one thing
about it. Rewrote `personalVibeFromAspects()` to actually do what "today's
positions compared to my chart" means: states today's real Sun/Moon
positions first, then the top 2 tightest real aspects and how each is
specifically interacting with the chart — a genuine comparison, not a
single cherry-picked data point. Verified against your real chart data:

"Sun's in Virgo, Moon's in Pisces today. Venus is creating friction with
your dreams, intuition, and confusion (already past its peak), and Saturn
is working smoothly with your core confidence and sense of self (already
past its peak)."

Also has a real "quiet day" fallback line for when nothing's within orb
that day, rather than forcing a match.

## "Today's vibe" grammar bug fixed
`PLANET_MEANING` in `transits.js` had inconsistent phrasing — some entries
included "your" (Sun, Moon, Mercury, Mars), others didn't (Venus, Jupiter,
Saturn, Uranus, Neptune, Pluto). Since which natal planet gets referenced
is random day-to-day, about half the possible sentences read correctly
("Saturn is creating friction with your core confidence") and the other
half read wrong ("Venus is creating friction with dreams, intuition, and
confusion" — missing the "your"). Normalized every entry and now always
supply "your" in the template, so it's grammatically consistent regardless
of which planet comes up. Verified all 50 planet/aspect combinations read
correctly, plus the exact sentence from the bug report specifically.

## Follow-up chat now persists (where the reading itself does too)
New `chat_messages` table, scoped by a context key so history stays
attached to the right reading:
- **Daily area readings**: key is `"{area}:{date}"` (e.g. "career:2026-08-28")
  — matches the reading's own daily reset, so tomorrow's fresh reading gets
  a fresh conversation too, not yesterday's leftover thread.
- **Full Chart Reading**: key is `"full_chart"` — one ongoing thread, since
  the reading itself is also one persistent row, regenerated on demand
  rather than daily.
- **Scenario advice**: deliberately still NOT persisted — consistent with
  the scenario reading itself never being saved either. Still labeled
  "(not saved)" in the UI for that one.

Opening a chat now loads its saved history first; each message (yours and
the reply) is saved in the background as you go, same fire-and-forget
pattern as the rest of the app's non-blocking saves.

## New: back-and-forth follow-up chat for Go Deeper
This had been on the list since early on. Every reading — the daily area
readings, scenario advice, and the new Full Chart Reading — now has an
"Ask a follow-up" chat underneath it.

- **New shared endpoint** `api/astrology-chat.js`: recomputes the same real
  transit-to-natal aspect data fresh for each reply (not just trusting the
  model's memory of the earlier reading), so follow-up answers stay
  grounded in your actual chart rather than drifting into generic
  conversation. If you ask about something the real data doesn't cover, it
  says so instead of inventing an aspect to sound more helpful.
- **New reusable component** `ChatFollowUp.jsx`: collapsed by default (an
  "Ask a follow-up" link), expands into a real chat thread — your messages
  and the replies, Enter to send. Same plain-language, ADHD-friendly,
  jargon-free voice as the readings themselves, but deliberately shorter
  (2-4 sentences) since it's a conversation, not another full reading each
  time.
- Wired into all three surfaces: daily area readings, scenario advice, and
  Full Chart Reading — the same component, just given different grounding
  context (which area, and what was already said).
- **Not persisted** — this is a live conversation, not saved to the
  database. Closing/refreshing clears it. Said so directly in the UI
  rather than implying it's saved when it isn't.
- Verified all three conversation contexts (area-specific, whole-chart,
  multi-turn history) plus the missing-input validation path — all execute
  cleanly with no crashes.

## New: Full Chart Reading (replaces astrocartography)
A comprehensive natal chart synthesis — the "past, present, future" request,
built honestly. Real computation wherever computation is possible, thematic
interpretation (not fortune-telling) where it isn't.

- **Real computed life-cycle dates**: `computeLifeCycles()` in
  `_ephemeris.js` does actual numerical root-finding to locate the exact
  date transiting Saturn/Jupiter return to their natal degree — genuine
  astronomical events (Saturn ~29.5yr cycle, Jupiter ~11.9yr cycle),
  computed from your specific birth data, not generic age estimates.
  Verified against your chart: Saturn return #1 landed at 2024-03-09 for a
  1994 birth — correct for a ~29.5-year cycle.
- **Identity synthesis**: Sun/Moon/Rising/Mercury/Venus/Mars woven into one
  cohesive picture, not six separate paragraphs.
- **Current chapter + coming months**: real computed aspects across your
  whole chart (not filtered to one life area like the daily readings), plus
  a longer 150-day lookahead for themes still building.
- **Honest framing, stated once**: the model is explicitly told this
  describes real cycles and their traditional themes, not guaranteed
  specific future events — no "you will get married" type claims. This
  matches how legitimate professional astrologers actually work; confident
  fortune-telling isn't more "professional," it's less honest.
- New `full_chart_readings` table (one row per user, regenerate on demand
  rather than daily-cached) — run the schema migration.
- Verified end-to-end with your real chart data (life cycles computed
  correctly, real current/upcoming aspects assembled, reaches the API
  cleanly) and with missing natal data (clean 400 error, not a crash).

## Plain-language, ADHD-friendly pass across every AI-facing surface
The just-shipped "personalized vibe" fix was itself a good example of the
problem: genuinely specific to your chart, but phrased as "orb 0.17°,
transiting, separating" — real jargon. Fixed across the board, not just
that one spot:

- **`transits.js`**: rewrote the personal-vibe generator with plain-English
  planet meanings ("Saturn is working smoothly with your core confidence
  and sense of self" instead of "Transiting Saturn trine natal Sun, orb
  0.17°"). Same real computed aspect underneath, translated into words
  anyone can read without astrology background.
- **`astrology.js`** (both the daily Go Deeper readings and the new
  scenario-advice path): added an explicit voice rule banning "orb,"
  "transiting," "natal," "applying," "separating" as bare jargon — the
  model can still name planets and aspects, just has to say what they mean
  in plain words in the same breath. Also reinforced the action_ideas
  field as the explicit "what do I actually do" answer, not just
  supplementary — it was already there, made sure it stays jargon-free too.
- **`coach.js`**: added a general rule covering every domain it touches
  (finance, content, astrology, anything) — explain terms as you use them,
  don't assume background knowledge, and make sure every substantive
  answer lands on both "what this means for you" and "what to do next,"
  even briefly, rather than just handing over information with no next step.

Verified all three modified endpoints (coach, Go Deeper daily reading, Go
Deeper scenario advice) still execute cleanly end-to-end after these
prompt changes.

## "Today's vibe" — from generic template to genuinely personal
Fair complaint: this was 3 rotating phrases per Moon element, shared by
anyone with the same Moon sign that day — barely about your actual chart.
Rewrote `transits.js` to compute the single tightest real transit-to-natal
aspect (same math as Go Deeper — real orbs, real applying/separating
trends) and build the vibe text from that specific, computed fact. Two
people with the same Moon sign today will not see the same text unless
their natal charts happen to produce an identical tightest aspect —
essentially never.

Verified directly: with your chart loaded, it now says "Transiting Saturn
is flowing easily with your natal Sun right now (orb 0.17°, separating)"
— a real, specific, only-yours fact. Without natal chart data uploaded, it
falls back to the old generic phrasing but now says so explicitly and
points you to add your chart in Settings, rather than silently passing off
a generic line as personal.

Also switched `/api/transits` from GET to POST so it can carry your full
natal chart notes (too much data for a clean query string) — updated both
call sites (`AstroSnapshot.jsx`, `ActionCenterTab.jsx`'s vibe banner).

## New: "Ask about a specific situation" in Go Deeper
The daily readings are unprompted — they cover whatever's astrologically
active for that area today. This adds the other half: describe an actual
situation you're facing, and get advice grounded in the same real
transit-to-natal aspect data, but answering YOUR question directly instead
of a generic day-in-the-life read.

- New collapsible "Ask about a specific situation" section under each
  area's daily reading — pick the area (Career/Friendships/Love/Finance)
  that fits, describe what's going on in a few sentences, tap "Get advice."
- Backend (`buildScenarioPrompt` in `api/astrology.js`) is a distinct
  prompt path: told to address the situation head-on in the first
  sentence, use the same real computed aspects as grounding but only where
  they genuinely bear on the situation (told explicitly not to force a
  connection if none of the given aspects are relevant), same
  applying/separating NOW-vs-SOON framing, plus 2-3 action ideas specific
  to the situation described.
- **Deliberately not cached** — this is a one-off ask, not "today's fixed
  reading" for that area, so it doesn't overwrite the daily cached content.
  Switching areas clears the scenario panel so an answer about a
  relationship situation doesn't linger under Finance.
- Verified both paths (daily reading and scenario advice) execute cleanly
  end-to-end, plus confirmed an empty/whitespace-only scenario correctly
  falls back to the standard daily-reading prompt instead of erroring.

## "Go deeper" action tidbit expanded into a real "Try this" section
Was a single sentence tacked onto the end of the prose reading. Now a
genuinely separate, structured section:
- Switched `api/astrology.js` to JSON-mode output: `{ reading, action_ideas }`
  instead of one plain-text blob. The reading itself no longer ends with an
  action line (moved out entirely) — 2-3 action ideas live in their own field.
- Each idea is required to be concrete and doable in the next few days,
  tied to a specific aspect from the reading, under 20 words, no hedging —
  "Send that email you've been sitting on" not "embrace communication."
  Explicitly told not to give 3 variations on the same idea.
- Frontend (`LifeAreaExplorer.jsx`) now renders these as a visually
  distinct "Try this" list with bullet points, separated from the prose
  by a divider — not buried in a paragraph anymore.
- **Backward compatible**: readings cached before this change are plain
  text, not JSON. Added a parser that tries JSON first and falls back to
  treating old cached text as the reading with no action ideas, rather
  than breaking on existing data. Verified against both old and new
  formats, plus empty/null edge cases, before shipping.

## "Today's vibe" was actually "this month's vibe" + Go Deeper stopped over-focusing on goals

**Why the vibe repeated**: the entire text was driven by the transiting
Sun's sign — but the Sun only changes sign once a month. Verified directly:
Sun stayed "Virgo" for 8 straight test days while the Moon cycled through
Pisces → Aries → Taurus → Gemini in that same window. A Sun-only vibe line
is identical for ~30 days at a stretch; that's not a daily read. Rewrote
`transits.js` to be **Moon-driven** instead (Moon changes sign every 2-3
days — the actual traditional astrological signal for day-to-day mood),
with 3 rotating phrasings per element chosen deterministically per-day so
even within one Moon-sign window it doesn't feel stuck. Sun sign is still
shown as brief seasonal context, and still drives the dot color.

**Go Deeper no longer mentions goals** — `core_goals` is no longer sent to
`api/astrology.js` at all (previously appended to every request), and the
prompt now explicitly frames these readings as being about the person's
general patterns/tendencies, not a goal-tracking check-in. The daily coach
(Action Center) still references real goal progress, since that's a
different, appropriately goal-oriented feature — this change is scoped
specifically to "Go Deeper."

## Astrocartography removed, goal editing added
Two separate changes:
- **Astrocartography removed entirely** — wasn't working the way you
  wanted, so cut rather than kept half-working. Removed the "Go Deeper"
  tab, the standalone `api/astrocartography.js` endpoint, and the
  astrocartography branch from `api/astrology.js`. The 4 remaining areas
  (Career, Friendships, Love, Finance) are unaffected — verified all 4
  still reach the API cleanly and that "astrocartography" is now correctly
  rejected as an invalid area instead of silently processed. The
  underlying ephemeris math (`astrocartographyChart` in `_ephemeris.js`)
  was left in place since it's inert now — nothing calls it — in case it's
  wanted again later; happy to strip it fully if preferred.
- **Goals are now editable.** Previously the only way to change a goal
  after creating it was logging payments/deposits (current amount) or
  checking off education milestones — the title, target amount, starting
  amount, and target date were all locked in at creation. Each goal card
  now has a pencil icon that opens an inline edit form for exactly those
  fields, type-appropriate (debt gets starting+remaining balance, savings
  gets target+saved, salary gets target, education gets title+date since
  milestones already have their own toggle UI).

## Fixed: "Could not find table 'public.goals'" + goals now import from Core Goals
Two things from the same report:
1. **The error** was just the `goals` table migration not having been run
   yet — same fix as every schema update: run `supabase/schema.sql` again.
2. **Real gap, now fixed**: the Goals tracker required manually retyping
   goals that already existed in Core Goals — no reason to make you write
   everything twice. New "Import from Core Goals" button on the Goals
   Progress section:
   - `parseGoalsFromText()` reads each line of your Core Goals text and
     classifies it (debt/savings/salary/education) using keyword matching
     — "credit card," "debt," "collections" → debt; "degree," "course" →
     education; a dollar amount near "salary"/"pay" → salary (and pulls
     the actual number, e.g. "$50,000+ salary" → target $50,000
     automatically); everything else → savings.
   - **Nothing is created silently** — it shows a review screen first
     where you can change the type, fill in target amounts the text didn't
     have (most goals don't state a dollar figure), remove any you don't
     want, then confirm.
   - Skips anything that title-matches a goal you've already added, so
     re-running the import later won't duplicate existing goals.
   - Verified the parser against your actual 5 goals before shipping — all
     5 classified correctly, salary target extracted correctly.

## Astrocartography was defaulting to career-only — fixed
Real bug: nothing forced the reading to cover more than the MC (career)
axis. Two causes — without birth latitude set, only MC/IC data exists at
all (ASC/DSC genuinely aren't computed), so a career+home-only reading was
the *ceiling* of what was possible; and even with full data, the prompt
said "pick 4 planets based on notable longitude values" with zero
requirement to spread across angle types, so the model could (and did)
just grab 4 tight MC values and talk about career four times over. Fixed:
- Added explicit angle-type meanings to the prompt (MC=career, IC=home/
  roots, ASC=identity, DSC=relationships) so the model has to actually
  reason about domain, not just pick by tightest orb.
- Now requires spreading across at least 3 of the 4 angle types when full
  data is available, explicitly told not to default to career.
- The closing suggestion no longer always uses a "for work" example —
  varies by whichever angle type turned out most significant.
- If birth latitude still isn't set, the reading now explicitly says so
  and splits evenly between MC/IC rather than leaning all-career even
  within that smaller data set.

## New: Structured goal tracking system (Blueprint tab)
Replaces the static goals paragraph with real, trackable progress across
4 goal types — new "Goal progress" section on the Blueprint tab, below
Core Goals (which stays as freeform notes for context).

- **Debt payoff**: enter what you owe now, log payments as you make them,
  progress bar counts down to $0.
- **Savings**: enter a target and (optionally) what you've already saved,
  log deposits, progress bar counts up.
- **Salary**: enter a target salary — progress is computed automatically
  from your Job Applications tracker (best offer if you have one, else
  your highest-expected-salary application). No manual updates needed;
  apply to jobs and this moves on its own.
- **Education**: milestone checklist (Applied → Accepted → Enrolled →
  Coursework → Graduated) instead of a number — tap to check off as you go.
- **Milestone badges**: "Off to a start" / "Halfway there" / "Almost
  there" / "🎉 Goal complete!" at 25/50/75/100%, shown right on the card.
- **Connected to the daily coach**: `ActionCenterTab` now fetches goal
  progress and feeds real numbers (not just goal titles) into the coach's
  context — it can say "you're 40% through paying off that card" instead
  of vaguely gesturing at "your goals." Verified this reaches the API
  cleanly with the new context field.

New `goals` table in `schema.sql` — run the migration. Full CRUD with the
same error-surfacing pattern as the rest of the app. Progress math verified
directly against your actual goal numbers (debt, savings, salary target)
before shipping.

## New: Job application tracker (Finance tab)
Log and track job applications toward your salary/job goal. New collapsible
section under Spending Trend on the Finance tab:
- **Log an application**: company, role, applied date (defaults to today,
  local-date-correct), expected salary (optional), job posting link
  (optional), notes (optional).
- **Status per application**: Applied → Interviewing → Offer, or
  Rejected/Withdrawn — a dropdown per row, not a forced linear cycle, since
  real job searches don't move in a straight line.
- **Header summary**: total logged, how many interviewing, how many offers
  — visible without opening the section.
- If your core goals mention "salary," a small note ties the section back
  to that goal explicitly.
- New `job_applications` table in `schema.sql` — run the migration.
- Full CRUD (`listJobApplications`, `addJobApplication`,
  `updateJobApplicationStatus`, `deleteJobApplication`) with the same
  error-surfacing pattern as the rest of the app — failed saves/updates
  show a real message, not a silent no-op.

## Root cause of empty responses found: hidden reasoning tokens
`"The model returned an empty response (finish_reason: length)"` wasn't
truncation in the usual sense — `openai/gpt-oss-120b` is a reasoning model
that, by default, spends hidden "thinking" tokens on internal reasoning
*before* writing the visible answer, and those tokens count against
`max_tokens` too. On a complex prompt (astrocartography, with 4 planets and
real-world geography reasoning), medium-effort reasoning could consume the
entire budget before a single visible word got written — hence empty
content with `finish_reason: length`, not a normal truncation.

Fixed at the source rather than just raising the token ceiling further:
added `reasoning_effort: "low"` to all four `openai/gpt-oss-120b` calls
(`coach.js`, `content.js`, `content-ideas.js`, `astrology.js`) — this is a
real parameter Groq exposes specifically for this model to cap how much of
the budget goes to invisible reasoning versus the actual answer. Verified
all four still execute cleanly end-to-end with the new parameter added.

## Micro-task checklist now actually connects to the coach
The checklist existed as a completely separate manual system — you'd have
to read the coach's answer and retype steps into the list by hand. That's
real friction on a feature whose whole point is removing friction, so it
wasn't earning its place on the page. Fixed:
- New `src/lib/extractSteps.js` parses bullet/numbered lines out of the
  coach's reply (it's already prompted to answer in bite-sized bullets, so
  this catches most responses cleanly). Falls back to treating a short,
  unstructured reply as one candidate — covers the "I'm overwhelmed"
  single-action responses, which don't use bullets by design.
- After any coach response, matched steps show as tappable chips ("Add to
  today's list") right under the answer. One tap adds it to the real
  checklist — no retyping.
- Respects the existing 3-item cap: chips gray out once today's list is
  full, with a clear message instead of silently doing nothing.
- Verified the parser against bulleted, numbered, single-action, and plain
  prose replies — correctly extracts from the first three, correctly
  returns nothing for unstructured prose that shouldn't become a task.

## "Turn this into a script" now actually connects to the content queue
Previously this button sent your text to the general coach chat and the
"script" it produced just displayed inline and vanished — never touched
the real content pipeline or got saved anywhere. Fixed:
- Separated it from the generic `QuickActions` prompts (those still go to
  `/api/coach`) into its own dedicated action that calls `/api/content`
  directly — the same endpoint and full 4-platform generation
  (TikTok/Reels, Instagram, X, Facebook, execution steps) as the Content tab.
- On success, it's saved via the same `saveScript` path the Content tab
  uses, so it shows up in "Your queue" immediately — genuinely the same
  data, not a parallel copy.
- Shows a real "Saved to your content queue" confirmation with a "View"
  link that jumps straight to the Content tab.
- Fixed a related bug this surfaced: `handleScriptSaved` in `App.jsx` was
  swallowing its own errors (catch-and-log, never rethrow), which meant a
  caller awaiting it would always think the save succeeded even if it
  silently failed. Now it rethrows, and both call sites (Action Center,
  Content Engine) handle that properly instead of assuming success.

## Tone update — warmer, more personal, still ADHD-brief
Every AI-facing prompt in the app now explicitly asks for a "friend who
also has a therapist's instincts" voice instead of a formal-assistant tone:
- **`coach.js`** (main chat, impulse pause, content coach — all route
  through this): contractions, natural phrasing, validates before advising
  when something's hard, no generic affirmations ("you've got this!"),
  light personality where it fits. Explicitly notes warmth is about word
  choice, not word count — the existing ADHD brevity rules (no fluff,
  bite-sized, one action when overwhelmed) still apply, just delivered
  warmer. Also added a light, non-heavy-handed note to gently point toward
  real professional support if something sounds like it goes beyond
  day-to-day coaching.
- **"Go deeper" readings and astrocartography**: now explicitly "talking
  directly to this person like a perceptive friend," second person,
  conversational — same strict grounding-in-real-data rules as before,
  just delivered like a friend telling you what they noticed in your chart
  rather than a formal report.
- **Content Engine's `core_message`/`engagement_tip`**: now asks for quick
  honest friend-notes phrasing ("this hook's solid but the ending's flat")
  over strategist-memo phrasing.

Verified all three modified handlers (`coach.js`, `content.js`,
`astrology.js`) still execute cleanly with the new prompts — no template
literal breakage, all reach the real Groq API without crashing.

## Truncation bug — checked all 5 Groq call sites, fixed what needed it
After finding the silent-truncation bug in astrology.js, audited every
place the app calls Groq:
- **`coach.js` (main chat) — same bug, and worse**: had no empty-response
  check at all, let alone truncation handling. This is the most-used
  feature in the app. Fixed with the same pattern: empty-response check,
  token budget raised 600→800, and truncated replies now trim to the last
  complete sentence instead of shipping a dangling fragment.
- **`content.js` and `content-ideas.js` (JSON-mode outputs)**: structurally
  different failure mode — a truncated JSON response fails to parse
  outright (unclosed braces), so it was already impossible for these to
  silently ship broken content; a parse failure was always a clear error.
  What was missing was diagnostic clarity, so both now report
  `finish_reason` and tell you specifically when the failure was a length
  cutoff vs. a genuine format issue.
- **`parse-natal-screenshots.js`**: already had truncation detection from
  an earlier fix (returns a `truncated` flag + warning rather than
  sentence-trimming, since it's structured chart data, not prose — trimming
  mid-chart-line would corrupt the data rather than just shorten it).
- **`astrology.js`**: the original fix, now verified against coach.js's
  identical trim logic too.

Verified each with direct handler execution (missing key, realistic
payloads) — all reach the real Groq API cleanly with zero crashes, and the
sentence-trim logic was tested in isolation against real truncated text to
confirm it produces clean output.

## Go Deeper readings were cutting off mid-sentence
The Love/Career/etc readings are genuinely accurate now (real aspects, exact
degrees, applying/separating trends — the earlier overhaul worked), but they
were silently truncating: the code only checked for *empty* responses, not
*truncated-but-nonempty* ones, so a reading that hit the token limit mid-word
("...someone you've felt a genuine spark with, and") still shipped as a
"successful" 200 response. Fixed:
- Raised `max_tokens` from 700 to 900 to make hitting the limit less likely.
- Tightened the prompt's word-count language (was "150-220 words" as a
  soft target the model routinely ignored; now a hard 220/250-word ceiling
  with explicit guidance to keep each aspect to 1-2 sentences).
- If it still truncates, the response is now trimmed back to the last
  complete sentence before being sent to the client — verified this
  actually produces a clean ending instead of a dangling fragment, using
  the exact truncated text from a real example.

## Astrocartography time-parsing bug fixed
Real bug, not a prompt issue this time: Postgres `time` columns come back
from Supabase as `"HH:MM:SS"` (seconds included), but the code assumed
`"HH:MM"` and blindly appended `:00` to build the ISO datetime string —
turning `"09:18:00"` into `"09:18:00:00"`, which fails to parse and threw
"Couldn't parse your stored birth date/time." every time. Fixed in both
`api/astrology.js` (the astrocartography branch) and the standalone
`api/astrocartography.js` — both now normalize to bare `HH:MM` via regex
regardless of what format comes back, and fall back gracefully to noon on
genuinely unparseable input instead of failing outright. Verified against
`"09:18:00"`, `"09:18"`, missing, and garbage input — all four now reach
the actual reading generation instead of erroring.

## This round: astrocartography fix, spending trends, Settings sections
- **Astrocartography fixed**: the prompt was over-indexing on hedging/
  disclaimers ("this isn't a full map," repeated caveats), which is exactly
  what produces a "generic" feeling response — the model played it safe
  instead of committing to substance. Rewrote it to require the caveat
  exactly once, cover 4 planets instead of 2-3, and *commit* to naming real
  regions/cities near each computed longitude rather than hedging on
  substance. Also added a UI hint when `birth_lat` isn't set in Settings,
  since that silently thins the data to MC/IC only (no Ascendant/Descendant)
  — now visible instead of an invisible quality drop.
- **Spending trends**: new `SpendingTrend.jsx` bar chart on the Finance tab
  — last 6 weeks of spending, red bars for over-budget weeks, current week
  highlighted. Lightweight (plain divs, no chart library added).
- **Settings reorganized into visible sections**: About you / Birth data /
  Finance / Goals / Astrology — was a flat list of 11 fields, now grouped
  with headers so it reads as organized categories.

Re-verified Content Engine (idea generator + 4-platform generation) and
astrocartography end-to-end with direct handler tests using realistic
payloads — both reach the real Groq API cleanly with zero code-level
crashes; only failure in this sandbox is its own network restriction,
which won't apply on your actual deployment.

## Content Engine overhaul — real per-platform content, idea generation, exact steps
Previously "Script/X Thread/Facebook" was really just one generic short-form
script plus two afterthought reformats — no actual Instagram output, no
proactive ideas (you had to already know what to post), and execution steps
were static/generic. Rebuilt properly:

- **4 real platforms**: TikTok/Reels (video script), Instagram (a genuinely
  separate caption — not the script — with 5 hashtags, written for how IG
  captions actually get read), X Thread (3 bullets, first one a standalone
  hook), Facebook (conversational, question-forward — FB rewards that
  differently than TikTok/IG).
- **New idea generator** (`api/content-ideas.js`, `IdeaGenerator.jsx`): "Need
  an idea? Get 5 suggestions" — generates 5 *specific angles* (not topics),
  each with a ready-to-use hook, a format tag (listicle / confession /
  hot-take / tutorial / pain-point — deliberately varied across the 5), and
  which platform it'd likely perform best on and why. Tap one to
  auto-populate the brain dump and generate immediately. Optional seed topic
  input if you want it pointed somewhere specific.
- **Exact execution steps, not generic ones**: 4-6 steps per piece, each
  requiring at most one decision (ADHD-friendly by design) — e.g. actual
  posting-time windows and an early-engagement action ("reply to the first 5
  comments within 30 min"), not "post consistently" filler. Checkboxes to
  work through them.
- **`engagement_tip`**: one concrete, piece-specific note on the single
  highest-leverage thing about that content — hook strength, format choice,
  timing, or a CTA to add. Not generic advice.
- New Supabase columns: `instagram_caption`, `execution_steps` (jsonb),
  `engagement_tip` on `scripts_and_ideas` — migration included, safe to
  re-run.

## Plaid removed
Bank auto-sync via Plaid was removed — sandbox-only bank linking wasn't
useful for actual day-to-day tracking, and going to production Plaid access
requires their approval process. Financial tracking is now manual-only:
tap "Log spending" on the Finance tab (amount + category), which is the
same modal that already existed — it's just the primary path now instead of
a fallback next to a bank-link button. All `api/plaid/*` routes,
`PlaidLinkButton.jsx`, and the `plaid`/`react-plaid-link` dependencies are
gone. The `plaid_access_token`/`plaid_item_id`/`plaid_cursor` columns in
`financial_accounts` are now vestigial — harmless to leave, or drop them
manually in Supabase if you want a fully clean schema.

Older sections below (Phase 3, the bug audit) still reference Plaid
historically — that's an accurate record of what was built and later
removed, not current instructions.

## Settings: Sun/Moon/Rising auto-derived, no longer separate fields
Those three fields were redundant with the natal chart upload — you'd be
entering the same information twice. Removed them from Settings entirely.
Now `src/lib/extractSigns.js` pulls Sun/Moon/Ascendant(Rising) straight out
of whatever's in the natal chart notes (pasted or uploaded), automatically,
every time you save. A small "Detected: Sun Leo · Moon Leo · Rising Libra"
confirmation shows right after a screenshot upload so it's visible that
extraction actually worked. If the notes don't mention one of the three
(rare, but possible with a partial screenshot), whatever was already saved
for that field is left alone rather than getting wiped.

Dashboard + `/api/coach.js` (Groq) + Supabase schema stubs.

## "Go deeper" overhaul — real aspects, not generic astrology
Previous readings only told the model "today the Sun is in Virgo" — no
degree precision, no actual relationship to the natal chart, nothing
forward-looking. With nothing concrete to work from, the model fell back on
generic sign-trait prose. Fixed properly:

- **`parseNatalLongitudes()`** in `_ephemeris.js` parses your natal chart
  notes text (tolerant of a few common formats) into exact ecliptic
  longitudes per planet.
- **`currentTransitAspects()`** computes REAL transit-to-natal aspects —
  actual angular separation between today's transiting planets and your
  natal planets, checked against the 5 major aspects (conjunction, sextile,
  square, trine, opposition) with standard orbs. This is genuine
  astronomical math, not an LLM guess.
- **Applying vs. separating, computed not guessed**: each aspect is checked
  again 5 days in the future to determine whether it's tightening
  (building toward exact — worth watching) or loosening (past its peak).
  This is what makes the reading actually forward-looking.
- The prompt now hands the model this real data and **forbids** generic
  sign-trait sentences ("Leos are natural leaders") — every sentence has to
  trace back to a specific computed aspect, and the reading must distinguish
  what's exact now from what's approaching over the next few days.
- **Area-relevant filtering**: each life area only surfaces aspects to the
  natal planets that actually matter for it (career → Sun/Saturn/Mars/
  Mercury/Jupiter, love → Venus/Mars/Moon/Sun, etc.) so the reading doesn't
  drown in irrelevant aspects.
- **Graceful degradation**: if no natal chart notes are on file (only
  Sun/Moon/Rising signs), it falls back to sign-level data and explicitly
  tells the model not to fabricate exact-degree claims it doesn't have —
  better a plainer reading than a confidently wrong one.

This depends on `natal_chart_notes` actually containing degree-level data
(e.g. "Sun: Leo 13°54'") — the seed data in `schema.sql` already has this
from your uploaded chart, so it should work immediately once that's loaded.

## Setup — 5-minute steps

**1. Install deps (2 min)**
```
npm install
```

**2. Create your env file (2 min)**
```
cp .env.example .env
```
Fill in `GROQ_API_KEY` (from console.groq.com). Leave Supabase blank for now — the app still runs without it.

**3. Run the frontend (1 min)**
```
npm run dev
```
Opens at `http://localhost:5173`. The dashboard renders; the coach input will error until the API is running (next step).

**4. Run the API locally (5 min)**
This repo targets Vercel serverless functions. Easiest local option:
```
npm i -g vercel
vercel dev
```
This serves both the Vite frontend and `/api/coach.js` together on one port — use that URL instead of step 3's.

**5. Set up Supabase (5 min)**
- Create a project at supabase.com
- Open the SQL editor, paste `supabase/schema.sql`, run it
- Copy your Project URL + anon key into `.env` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`

**6. Deploy (5 min)**
```
vercel
```
Then add `GROQ_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in the Vercel project's Environment Variables settings, and redeploy.

## Latest update: 4 fixes/upgrades
1. **Settings save bug, actually fixed this time**: an empty `birth_date` or
   `birth_time` field was sent as `""` to a Postgres `date`/`time` column,
   which Postgres rejects — and because it's all one UPDATE statement, that
   ONE bad field silently killed the entire save, including fields like
   `core_goals` that were perfectly valid. `SettingsModal` now converts blank
   fields to `null` before saving.
2. **Screenshot upload for natal charts**: Settings now has an "Upload
   screenshots instead (up to 5)" button next to the notes field. Select
   multiple screenshots of your chart report (planet table, house table,
   aspect table, etc.) at once — they're sent together to Groq's vision
   model (`qwen/qwen3.6-27b`, via `/api/parse-natal-screenshots.js`), which
   reads across all of them and condenses everything into the same
   structured chart notes format. Manual pasting still works too, and
   uploads append to (rather than overwrite) whatever's already in the box,
   so you can add a few, check the result, then add more if something's missing.
3. **Real ephemeris engine, no API key needed**: swapped the placeholder
   `TRANSIT_API_KEY` fetch for `astronomy-engine` (`api/_ephemeris.js`) —
   actual astronomical calculation of every planet's current tropical sign,
   done locally, for free, no external service. `/api/transits.js` and the
   "Go deeper" readings both use it now.
4. **"Go deeper" is now today-specific and includes real astrocartography**:
   - Career/Friendships/Love/Finance readings now pull *today's* real
     transiting placements (via the ephemeris engine) alongside your natal
     chart, and the prompt requires the model to name a specific transit
     interacting with a specific natal placement — not a generic lifelong
     summary. Readings are cached per day (`astrology_insights.for_date`) and
     a new button appears each day rather than showing yesterday's text forever.
   - **Astrocartography now uses real computed angles.** `api/_ephemeris.js`
     computes actual MC/IC meridians (exact) and ASC/DSC longitudes at your
     specific birth latitude (a real point, not a full curve) using proper
     spherical astronomy (hour-angle formula from RA/Dec/latitude), from your
     birth date/time/UTC offset. There's also a standalone
     `/api/astrocartography.js` endpoint you can call directly. Honest limit:
     full ASC/DSC *curves* (which vary continuously by latitude) aren't
     rendered — the AI reading says this plainly and points to a dedicated
     map tool for that level of precision.
   - **New required fields** for astrocartography to work: `birth_lat`,
     `birth_lng`, `birth_utc_offset` in Settings. Run the migration in
     `schema.sql` before using this.

## Full bug audit (this pass)
Went through every file, ran the production build, syntax-checked every API
route, and exercised handlers directly with mock requests/responses. Found
and fixed:

1. **Critical, systemic**: `new Groq({...})` was instantiated at module load
   time in `coach.js`, `content.js`, `astrology.js`, and
   `parse-natal-screenshots.js`. If `GROQ_API_KEY` was ever missing, the SDK
   constructor throws *synchronously at import* — before any handler code or
   try/catch runs — producing the same raw platform crash we spent a long
   time chasing with `astronomy-engine` earlier. Fixed in all four files:
   Groq is now instantiated lazily inside the handler, after the key check.
   Verified with direct handler tests that all four now fail with clean JSON
   errors instead of crashing.
2. **Real functional bug**: the "Weekly budget" field in Settings wrote to
   `user_profile.weekly_budget`, but the Finance tab actually reads
   `financial_accounts.weekly_spend_limit` — two disconnected fields.
   Editing that Settings field visibly did nothing. Now synced: saving it in
   Settings updates the account's operational budget too.
3. **`sync-transactions.js`**: unbounded `while (hasMore)` loop with no cap
   — a misbehaving Plaid response could loop until function timeout. Capped
   at 20 iterations.
4. **`exchange-public-token.js`**: silently returned success even if
   Supabase wasn't configured, so a linked bank would never actually save
   and would appear unlinked again with zero explanation. Now errors loudly.
5. **All three Plaid handlers**: generic error messages hid the real Plaid
   error. Now surface actual detail.
6. **`ExpenseModal.jsx`**: no error handling around the save — a failed
   write was an invisible unhandled rejection. Fixed.
7. **`ActionCenterTab.jsx`**: the main coach call (the most-used feature in
   the app) didn't read the real error message from failed responses,
   unlike every other endpoint. Also, micro-task checkbox saves had zero
   error handling — a failed save just silently didn't update the UI, no
   explanation. Both fixed, with a dedicated error slot next to the checklist.
8. **`ContentEngine.jsx`**: the Copy buttons didn't await or check
   `navigator.clipboard.writeText()` — a failed copy (common in some mobile
   browser contexts) still showed "Copied" for 1.5s. Now shows "Couldn't
   copy" on actual failure.
9. **`ContentQueue.jsx` / `TransactionsAccordion.jsx`**: failed loads/status
   changes/deletes were console-only, no user-facing error — fixed to
   surface inline messages instead of failing invisibly.
10. **`SettingsModal.jsx`**: no client-side size check before uploading up
    to 5 full-resolution screenshots, risking a slow upload that dies with
    an unhelpful raw error at the server's body-size limit. Added a
    pre-flight size check with a clear message.

**Verified clean**: production build passes, every API file syntax-checks,
all four Groq-dependent handlers and all three Plaid handlers tested
directly with mock requests, the ephemeris math checked against 8 known
reference dates including a 24-years-out drift check (all correct),
`_supabaseServer.js`/`src/lib/supabase.js` confirmed safe without env vars,
`useKadijaData.js` closure behavior confirmed correct.

**Known low-risk limitation, not fixed**: `getOrCreateProfile()` has a
theoretical race condition if called twice concurrently before the first
insert completes (could create two profile rows). Low practical risk for a
single-user, single-client app; would need a proper upsert-on-conflict or
auth-scoped row to fully close.

## Settings wiring audit + Content Engine upgrade
A full audit found several Settings fields were stored but never actually
used by the AI anywhere:
- **name, pronoun, birth_location**: now included in the coach's context
  (`ActionCenterTab` sends them, `coach.js` is instructed to use pronoun
  naturally). Previously stored and silently ignored.
- **core_goals**: was only reaching the daily coach, not the "Go Deeper"
  astrology readings. Career/Finance readings can now reference your actual
  goals when relevant — instructed not to force it if it doesn't fit.
- **birth_lng**: confirmed as intentionally unused — the astrocartography
  math only needs latitude + UTC offset, not longitude, so this one's fine
  as a display-only field, not a bug.

**Content Engine was completely generic** — zero awareness of who you are,
and every piece of generated content vanished the moment you navigated away
(saved to `scripts_and_ideas`, but nothing ever read it back). Fixed both:
- `api/content.js` now receives your name/goals/chart as subtle context —
  used for voice/tone only, never stated outright in the actual content.
- Each generated piece now includes a `coaching_tip`: one concrete,
  content-specific posting note, not generic "be consistent" advice.
- New **"Your queue"** panel (`ContentQueue.jsx`) on the Content tab — browse
  everything you've generated, tap the status pill to cycle
  Draft → Ready → Posted, expand to reread the script, delete what you don't
  want. This is the missing piece that makes `scripts_and_ideas` actually useful.

**On social media integration**: true auto-posting to Instagram/TikTok/X
needs each platform's own developer API and OAuth approval process (Meta
Graph API review, TikTok developer approval, X API tiers) — that's a
separate, heavier project per platform, not a quick wire-up. What's built
instead is real content *coaching* (personalized generation + a working
queue) without pretending to post on your behalf.

## Natal chart data on file
Your full chart (from the screenshots) is documented in the commented-out
seed insert at the bottom of `schema.sql` — planets, houses, aspects, Part
of Fortune, South Node. Uncomment and run it, or paste the equivalent text
into the Settings natal chart notes field directly.

## Tab-based layout (latest update)
The app is now a 4-tab structure with a persistent bottom bar, matching the
updated blueprint:
- **Action Center** (`src/tabs/ActionCenterTab.jsx`): 1-line transit vibe banner,
  the coach input + quick actions, and a 1–3 item micro-task checklist that
  persists to `daily_blueprint.micro_tasks` (new jsonb column).
- **Content Engine** (`src/tabs/ContentEngineTab.jsx`): wraps the existing brain-dump
  → script/thread/post engine, unchanged.
- **Financial Hub** (`src/tabs/FinancialHubTab.jsx`): safe-to-spend bar, quick-log
  modal, a 30-second Impulse Pause widget (`src/components/ImpulsePause.jsx` — asks
  the coach one non-judgmental question), Plaid link/sync, and a collapsible
  transactions accordion.
- **Blueprint & Chart** (`src/tabs/BlueprintTab.jsx`): saved Sun/Moon/Rising, a core
  goals / life vision field (new `user_profile.core_goals` column, fed into every
  coach request as context), and the settings edit flow.

Note: the blueprint's schema calls this table `content_hub` — this build keeps the
existing `scripts_and_ideas` table name from Phase 2 rather than renaming, since it's
the same shape. Rename in `schema.sql` if you want the naming to match exactly.

AI engine stays on **Groq** (`openai/gpt-oss-120b`), not Gemini, per your last request —
`/api/coach.js` and `/api/content.js` are unchanged on that front.

## What's in Phase 1
- Action-first dashboard: one primary input, 4 one-tap prompts
- `/api/coach.js`: calls Groq (`openai/gpt-oss-120b`) with ADHD-coach system rules baked in
- Astro snapshot card + Finance pulse card
- `supabase/schema.sql`: all 5 core tables, permissive RLS for single-user use

## What's in Phase 2
- **Supabase wired up**: `src/lib/db.js` + `src/lib/useKadijaData.js` load/create your profile,
  today's blueprint, and financial account on load. If `.env` has no Supabase keys, the app
  falls back to a "no database" mode so it still runs.
- **Coach input now saves your focus** to `daily_blueprint` for today, and passes your
  Sun/Moon/Rising to `/api/coach.js` as context.
- **Quick-expense modal**: tap the `+` on the Finance card, log an amount + category, it
  writes to `transactions` and the safe-to-spend bar updates immediately.
- **Content engine**: `/api/content.js` turns a rambling brain dump into a ≤130-word script
  (hook first line), a 3-bullet X thread, and an ≤80-word Facebook post — all from one Groq
  call returning strict JSON. Each result auto-saves to `scripts_and_ideas`. The script tab
  includes 4 checkbox micro-steps (read hook → film → b-roll → upload) so "make a video"
  never sits as one big undone task.
- Optional: uncomment the seed insert at the bottom of `supabase/schema.sql` to pre-fill your
  profile with the natal chart data already on file (Sun Leo, Moon Leo, Rising Libra).

## What's in Phase 3
- **Plaid Link**: `PlaidLinkButton` opens Plaid's Link flow (sandbox by default),
  exchanges the public token via `/api/plaid/exchange-public-token.js`, and stores
  the access token on your `financial_accounts` row. Once linked, the button
  becomes a "Sync" action that calls `/api/plaid/sync-transactions.js`
  (`transactionsSync`, cursor-based) and writes new transactions straight into
  `transactions` — the safe-to-spend bar reflects real bank activity automatically.
  Needs `PLAID_CLIENT_ID` + `PLAID_SECRET` in `.env` to activate; without them the
  button still renders but linking will show an error toast.
- **Real transit data**: `/api/transits.js` computes today's Sun sign and a
  one-line vibe with zero setup (no API key needed). If you set `TRANSIT_API_KEY`,
  it calls out to a real ephemeris provider instead — the fetch URL in that file
  is a placeholder (`freeastrologyapi.com`-shaped) since providers differ; swap it
  for whichever one you sign up with and adjust the response parsing.
- **Settings screen**: gear icon in the header opens `SettingsModal` — edit name,
  pronoun, birth date/time/location, Sun/Moon/Rising signs, and weekly budget.
  Saves straight to `user_profile`, and everything downstream (astro card, coach
  context, finance budget) picks it up immediately.

## Not yet built (Phase 4+)
- Multi-user auth (RLS policies are currently permissive, single-user only)
- Editing/deleting saved scripts from `scripts_and_ideas` (currently write + list only)
- Real ephemeris response parsing in `/api/transits.js` (fallback vibe logic runs
  even when a provider key is set — only the raw payload differs)
- Multiple linked bank accounts (schema/UI currently assume one `financial_accounts` row)
