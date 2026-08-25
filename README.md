# Kadija — Life Blueprint (Phase 1 MVP)

Dashboard + `/api/coach.js` (Groq) + Supabase schema stubs.

## Setup — 5-minute steps

**1. Install deps (2 min)**
```
npm install
```

**2. Create your env file (2 min)**
```
cp .env.example .env
```
Fill in `GROQ_API_KEY` (from console.groq.com). Leave Supabase/Plaid blank for now — the app still runs without them.

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

**6. (Optional) Link Plaid sandbox (5 min)**
Get free sandbox credentials at dashboard.plaid.com, add `PLAID_CLIENT_ID` and
`PLAID_SECRET` to `.env`, leave `PLAID_ENV=sandbox`. In Plaid's sandbox Link flow,
use username `user_good` / password `pass_good` for any test bank.

**7. Deploy (5 min)**
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
