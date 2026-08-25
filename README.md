# Kadija — Life Blueprint (Phase 1 MVP)

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
