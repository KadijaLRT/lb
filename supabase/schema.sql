-- Kadija Life Blueprint — Phase 1 schema stubs
-- Run in Supabase SQL editor. Single-user app, so RLS is permissive by default;
-- tighten with auth.uid() checks once auth is wired up.

create extension if not exists "uuid-ossp";

-- Core profile: birth chart + preferences, referenced by the AI coach on every call
create table if not exists user_profile (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  pronoun text,
  birth_date date,
  birth_time time,
  birth_location text,
  birth_lat numeric,
  birth_lng numeric,
  birth_utc_offset numeric,
  sun_sign text,
  moon_sign text,
  rising_sign text,
  weekly_budget numeric default 0,
  core_goals text,
  natal_chart_notes text,
  created_at timestamptz default now()
);

-- Daily blueprint: one row per day, holds the primary focus + energy tags
create table if not exists daily_blueprint (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references user_profile(id) on delete cascade,
  date date not null default current_date,
  primary_focus text,
  micro_tasks jsonb default '[]'::jsonb,
  element_tag text check (element_tag in ('fire', 'earth', 'air', 'water')),
  transit_summary text,
  completed boolean default false,
  created_at timestamptz default now(),
  unique (user_id, date)
);

-- Financial accounts: Plaid-linked or manual
create table if not exists financial_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references user_profile(id) on delete cascade,
  provider text default 'manual' check (provider in ('plaid', 'manual')),
  plaid_access_token text,
  plaid_item_id text,
  plaid_cursor text,
  account_name text,
  cached_balance numeric,
  weekly_spend_limit numeric,
  updated_at timestamptz default now()
);

-- Transactions: unified for Plaid pulls + quick manual logs
create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references financial_accounts(id) on delete cascade,
  amount numeric not null,
  category text,
  note text,
  source text default 'manual' check (source in ('plaid', 'manual')),
  occurred_at timestamptz default now()
);

-- Cached deep-dive astrology readings, one per life area, regenerated on demand
create table if not exists astrology_insights (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references user_profile(id) on delete cascade,
  area text not null check (area in ('career', 'friendships', 'love', 'finance', 'astrocartography')),
  content text,
  for_date date default current_date,
  updated_at timestamptz default now(),
  unique (user_id, area, for_date)
);

alter table astrology_insights enable row level security;
drop policy if exists "allow all - phase1" on astrology_insights;
create policy "allow all - phase1" on astrology_insights for all using (true) with check (true);

-- Structured goal tracking — debt payoff, savings targets, salary goal
-- (cross-referenced against job_applications), and education milestones.
create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references user_profile(id) on delete cascade,
  type text not null check (type in ('debt', 'savings', 'salary', 'education', 'other')),
  title text not null,
  starting_amount numeric,
  current_amount numeric default 0,
  target_amount numeric,
  target_date date,
  milestones jsonb default '[]'::jsonb,
  status text default 'active' check (status in ('active', 'completed', 'paused')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table goals enable row level security;
drop policy if exists "allow all - phase1" on goals;
create policy "allow all - phase1" on goals for all using (true) with check (true);

-- Atomic backend fixes for the read-modify-write races found in the app
-- audit. The client-side busy-flag guards added during that audit only
-- protect against a race WITHIN one browser tab — they do nothing against
-- the same user on two devices, a retried request, or any client that
-- doesn't happen to run this app's exact JS. Postgres serializes
-- concurrent UPDATEs to the same row at the engine level, so doing the
-- whole read-modify-write in a single atomic statement (via RPC, since
-- the Supabase REST client can't express "new value = old value + delta"
-- in a plain .update() call) eliminates the race entirely, for every
-- client, not just this one. The frontend busy-flags stay in place too —
-- they're still worth keeping for the UX (visibly disabling a button
-- while its action is in flight), just no longer the only thing
-- protecting data integrity.

-- Fixes GoalsTracker.jsx's logAmount race: two rapid "log payment/deposit"
-- clicks on the same goal used to both read the same stale current_amount
-- and compute the same next value client-side. Now the increment happens
-- entirely inside the UPDATE statement, so Postgres's own row locking
-- guarantees two concurrent calls both apply, in some order, correctly —
-- neither can ever be silently lost.
create or replace function increment_goal_amount(p_goal_id uuid, p_delta numeric)
returns goals
language plpgsql
as $$
declare
  result goals;
begin
  update goals
  set current_amount = greatest(0, coalesce(current_amount, 0) + p_delta),
      updated_at = now()
  where id = p_goal_id
  returning * into result;

  if not found then
    raise exception 'Goal % not found', p_goal_id;
  end if;

  return result;
end;
$$;

-- Persisted follow-up chat messages for Go Deeper readings. Scoped by a
-- context_key so daily area readings get a fresh thread each day
-- (e.g. "career:2026-08-28") while the Full Chart reading gets one ongoing
-- thread ("full_chart"). Scenario advice deliberately has no persisted
-- thread — matches the scenario reading itself not being saved either.
create table if not exists chat_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references user_profile(id) on delete cascade,
  context_key text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

alter table chat_messages enable row level security;
drop policy if exists "allow all - phase1" on chat_messages;
create policy "allow all - phase1" on chat_messages for all using (true) with check (true);

-- Full chart reading — comprehensive natal synthesis with real computed
-- life-cycle dates (Saturn/Jupiter returns). One row per user, regenerated
-- on demand rather than daily-cached like the area readings.
create table if not exists full_chart_readings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references user_profile(id) on delete cascade unique,
  content jsonb,
  generated_at timestamptz default now()
);

alter table full_chart_readings enable row level security;
drop policy if exists "allow all - phase1" on full_chart_readings;
create policy "allow all - phase1" on full_chart_readings for all using (true) with check (true);

-- Migration for existing installs — create table if not exists won't add
-- new columns to an already-existing scripts_and_ideas table.
alter table scripts_and_ideas add column if not exists posted_at jsonb default '{}'::jsonb;

-- Voice sample for content generation — paste real past posts so
-- generated content actually matches how the person sounds
alter table user_profile add column if not exists content_voice_sample text;

-- Algorithm-boost fields for generated content
alter table scripts_and_ideas add column if not exists hook_variants jsonb default '[]'::jsonb;
alter table scripts_and_ideas add column if not exists algorithm_boost jsonb default '[]'::jsonb;
alter table scripts_and_ideas add column if not exists hashtags jsonb default '{}'::jsonb;

-- Job application tracker — works toward the salary/job goal in core_goals
create table if not exists job_applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references user_profile(id) on delete cascade,
  company text not null,
  role text not null,
  status text default 'applied' check (status in ('applied', 'interviewing', 'offer', 'rejected', 'withdrawn')),
  applied_date date default current_date,
  expected_salary numeric,
  job_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table job_applications enable row level security;
drop policy if exists "allow all - phase1" on job_applications;
create policy "allow all - phase1" on job_applications for all using (true) with check (true);

-- Scripts and ideas: content engine output
create table if not exists scripts_and_ideas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references user_profile(id) on delete cascade,
  raw_brain_dump text,
  short_form_script text,
  instagram_caption text,
  x_thread text,
  facebook_post text,
  execution_steps jsonb default '[]'::jsonb,
  engagement_tip text,
  word_count int,
  status text default 'draft' check (status in ('draft', 'ready', 'posted')),
  -- Per-platform posted tracking — a piece can be posted to TikTok but
  -- still sitting as a draft on X, so one shared status wasn't enough to
  -- answer "what have I actually posted where." jsonb like
  -- {"tiktok": "2026-09-02", "x": null, "instagram": null, "facebook": null}
  posted_at jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Optional: seed your profile with the natal chart data already on file
-- (Kingston, Jamaica, 08/06/1994 09:18 — Sun Leo, Moon Leo, Rising Libra).
-- Uncomment and run once if you'd rather not fill this in via the UI later.
-- insert into user_profile (name, pronoun, birth_date, birth_time, birth_location, birth_lat, birth_lng, birth_utc_offset, sun_sign, moon_sign, rising_sign, weekly_budget, natal_chart_notes)
-- values (
--   'K', 'She', '1994-08-06', '09:18', 'Kingston, Jamaica', 18.0000, -76.8000, -5,
--   'Leo', 'Leo', 'Libra', 200,
--   'Sun 13°54 Leo (XI). Moon 4°16 Leo (XI). Mercury 6°48 Leo (XI). Venus 28°56 Virgo (XII). ' ||
--   'Mars 23°15 Gemini (IX). Jupiter 6°35 Scorpio (II). Saturn 10°53 Pisces R (VI). ' ||
--   'Uranus 23°33 Capricorn R (IV). Neptune 21°22 Capricorn R (IV). Pluto 25°18 Scorpio (II). ' ||
--   'Lilith 13°27 Taurus (VIII). N Node 19°49 Scorpio (II). Ascendant Libra 2°28. MC Cancer 2°22. ' ||
--   'Houses (Placidus): II Scorpio, III Sagittarius, IV Capricorn, V Aquarius, VI Pisces, VII Aries, ' ||
--   'VIII Taurus, IX Gemini, X Cancer, XI Leo, XII Virgo. ' ||
--   'Key aspects: Sun conjunct Moon (43), Sun conjunct Mercury (315), Sun square Lilith (-139), ' ||
--   'Moon conjunct Mercury (508), Moon square Jupiter (-86), Moon sextile ASC (115), ' ||
--   'Venus conjunct ASC (90), Venus square Mars (-3), Venus trine Uranus (16), Venus sextile Pluto (33), ' ||
--   'Mars conjunct MC (21), Jupiter trine Saturn (42), Jupiter opposition Lilith (-24), Jupiter trine MC (24), ' ||
--   'Uranus conjunct Neptune (156), Uranus sextile Pluto (78), Pluto conjunct N Node (0).'
-- );

-- Migrations for existing databases (safe to re-run — no-ops if columns exist)
alter table daily_blueprint add column if not exists micro_tasks jsonb default '[]'::jsonb;
alter table user_profile add column if not exists core_goals text;
alter table user_profile add column if not exists natal_chart_notes text;
alter table user_profile add column if not exists birth_lat numeric;
alter table user_profile add column if not exists birth_lng numeric;
alter table user_profile add column if not exists birth_utc_offset numeric;
alter table financial_accounts add column if not exists plaid_item_id text;
alter table financial_accounts add column if not exists plaid_cursor text;
alter table astrology_insights add column if not exists for_date date default current_date;
alter table scripts_and_ideas add column if not exists instagram_caption text;
alter table scripts_and_ideas add column if not exists execution_steps jsonb default '[]'::jsonb;
alter table scripts_and_ideas add column if not exists engagement_tip text;
-- Old unique(user_id, area) constraint conflicts with the new per-date one; drop it if present.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'astrology_insights_user_id_area_key'
  ) then
    alter table astrology_insights drop constraint astrology_insights_user_id_area_key;
  end if;
end $$;
alter table astrology_insights drop constraint if exists astrology_insights_user_id_area_for_date_key;
alter table astrology_insights add constraint astrology_insights_user_id_area_for_date_key unique (user_id, area, for_date);

-- Permissive RLS for single-user Phase 1 (tighten later)
alter table user_profile enable row level security;
alter table daily_blueprint enable row level security;
alter table financial_accounts enable row level security;
alter table transactions enable row level security;
alter table scripts_and_ideas enable row level security;

drop policy if exists "allow all - phase1" on user_profile;
create policy "allow all - phase1" on user_profile for all using (true) with check (true);
drop policy if exists "allow all - phase1" on daily_blueprint;
create policy "allow all - phase1" on daily_blueprint for all using (true) with check (true);
drop policy if exists "allow all - phase1" on financial_accounts;
create policy "allow all - phase1" on financial_accounts for all using (true) with check (true);
drop policy if exists "allow all - phase1" on transactions;
create policy "allow all - phase1" on transactions for all using (true) with check (true);
drop policy if exists "allow all - phase1" on scripts_and_ideas;
create policy "allow all - phase1" on scripts_and_ideas for all using (true) with check (true);

-- Three more atomic backend fixes, same reasoning as increment_goal_amount
-- above — moving each read-modify-write entirely into one database
-- statement instead of a client-computed round trip.

-- Fixes ContentQueue.jsx's cycleStatus race: two rapid clicks on the same
-- status pill used to both read the same stale status and compute the
-- same "next" value client-side, skipping a step in the cycle instead of
-- advancing twice. The CASE expression reads the row's OWN current value
-- at the moment of the atomic update, never a value supplied by the
-- client, so this can't desync from reality no matter how many concurrent
-- callers there are.
create or replace function cycle_script_status(p_script_id uuid)
returns scripts_and_ideas
language plpgsql
as $$
declare
  result scripts_and_ideas;
begin
  update scripts_and_ideas
  set status = case status
    when 'draft' then 'ready'
    when 'ready' then 'posted'
    else 'draft'
  end
  where id = p_script_id
  returning * into result;

  if not found then
    raise exception 'Script % not found', p_script_id;
  end if;

  return result;
end;
$$;

-- Fixes PostingCalendar.jsx's togglePosted race — the more serious one
-- from the audit, since it wasn't just "the same button clicked twice"
-- but two DIFFERENT platform checkmarks on the same item, both reading
-- the same stale posted_at object, one silently overwriting the other's
-- write. The jsonb merge/key-removal happens inside the UPDATE itself, so
-- concurrent toggles of different keys on the same row can never clobber
-- each other — Postgres's own row locking serializes them correctly.
create or replace function toggle_script_platform_posted(p_script_id uuid, p_platform_key text, p_posted_date date)
returns scripts_and_ideas
language plpgsql
as $$
declare
  result scripts_and_ideas;
  current_val jsonb;
begin
  select posted_at into current_val from scripts_and_ideas where id = p_script_id for update;

  if current_val is null then
    current_val := '{}'::jsonb;
  end if;

  if current_val ? p_platform_key then
    current_val := current_val - p_platform_key;
  else
    current_val := current_val || jsonb_build_object(p_platform_key, p_posted_date);
  end if;

  update scripts_and_ideas
  set posted_at = current_val
  where id = p_script_id
  returning * into result;

  if not found then
    raise exception 'Script % not found', p_script_id;
  end if;

  return result;
end;
$$;

-- Fixes ActionCenterTab.jsx's addSuggestedStep race — two different
-- suggested-step chips clicked quickly used to both read the same stale
-- micro_tasks array and both compute "array + 1 new item" from it,
-- meaning the second write could silently drop the first task. Handles
-- both "today's row doesn't exist yet" (insert) and "it exists, append to
-- the array" (update) in one atomic upsert — the jsonb concatenation
-- happens server-side against whatever the row's CURRENT array actually
-- is, not a client-side snapshot of it.
create or replace function append_micro_task(p_user_id uuid, p_date date, p_task jsonb)
returns daily_blueprint
language plpgsql
as $$
declare
  result daily_blueprint;
begin
  insert into daily_blueprint (user_id, date, micro_tasks)
  values (p_user_id, p_date, jsonb_build_array(p_task))
  on conflict (user_id, date)
  do update set micro_tasks = coalesce(daily_blueprint.micro_tasks, '[]'::jsonb) || jsonb_build_array(p_task)
  returning * into result;

  return result;
end;
$$;
