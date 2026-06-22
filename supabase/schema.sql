-- =========================================================================
-- DailyOS — Supabase schema
-- Run this once in your Supabase Dashboard → SQL Editor → New Query → Run.
-- Safe to re-run: every block is idempotent.
-- =========================================================================

-- ---------- PROFILES ----------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar text,
  currency text default 'BDT',
  priorities text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar', '🦊')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- EVENTS ------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  time text not null default '',
  type text not null default 'Other',
  priority text not null default 'Medium',
  completed boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists events_user_date_idx on public.events(user_id, date);

grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;

alter table public.events enable row level security;

drop policy if exists "events_owner_all" on public.events;
create policy "events_owner_all" on public.events
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- EXPENSES ----------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric not null default 0,
  type text not null default 'expense',         -- 'income' | 'expense'
  category text not null default 'Others',
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_created_idx on public.expenses(user_id, created_at desc);

grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;

alter table public.expenses enable row level security;

drop policy if exists "expenses_owner_all" on public.expenses;
create policy "expenses_owner_all" on public.expenses
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================================
-- Done. Next:
--   1. Authentication → Providers → Google → Enable, add Client ID/Secret.
--   2. Authentication → URL Configuration → add your site URL + preview URL.
-- =========================================================================
