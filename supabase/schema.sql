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
