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
  sun_sign text,
  moon_sign text,
  rising_sign text,
  weekly_budget numeric default 0,
  core_goals text,
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

-- Scripts and ideas: content engine output
create table if not exists scripts_and_ideas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references user_profile(id) on delete cascade,
  raw_brain_dump text,
  short_form_script text,
  x_thread text,
  facebook_post text,
  word_count int,
  status text default 'draft' check (status in ('draft', 'ready', 'posted')),
  created_at timestamptz default now()
);

-- Optional: seed your profile with the natal chart data already on file
-- (Kingston, Jamaica, 08/06/1994 09:18 — Sun Leo, Moon Leo, Rising Libra).
-- Uncomment and run once if you'd rather not fill this in via the UI later.
-- insert into user_profile (name, pronoun, birth_date, birth_time, birth_location, sun_sign, moon_sign, rising_sign, weekly_budget)
-- values ('K', 'She', '1994-08-06', '09:18', 'Kingston, Jamaica', 'Leo', 'Leo', 'Libra', 200);

-- Migrations for existing databases (safe to re-run — no-ops if columns exist)
alter table daily_blueprint add column if not exists micro_tasks jsonb default '[]'::jsonb;
alter table user_profile add column if not exists core_goals text;
alter table financial_accounts add column if not exists plaid_item_id text;
alter table financial_accounts add column if not exists plaid_cursor text;

-- Permissive RLS for single-user Phase 1 (tighten later)
alter table user_profile enable row level security;
alter table daily_blueprint enable row level security;
alter table financial_accounts enable row level security;
alter table transactions enable row level security;
alter table scripts_and_ideas enable row level security;

create policy "allow all - phase1" on user_profile for all using (true) with check (true);
create policy "allow all - phase1" on daily_blueprint for all using (true) with check (true);
create policy "allow all - phase1" on financial_accounts for all using (true) with check (true);
create policy "allow all - phase1" on transactions for all using (true) with check (true);
create policy "allow all - phase1" on scripts_and_ideas for all using (true) with check (true);
