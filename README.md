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
