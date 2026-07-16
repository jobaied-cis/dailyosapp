
-- =========================================================================
-- DailyOS full cloud schema
-- =========================================================================

-- ---------- PROFILES ----------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar text,
  currency text default 'BDT',
  priorities text[] default '{}',
  timezone text,
  notification_enabled boolean not null default false,
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
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- EXPENSES ----------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric not null default 0,
  type text not null default 'expense',
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
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- TASKS -------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  note text,
  time text not null default '',
  end_time text,
  repeat jsonb,
  date date,
  priority text,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_idx on public.tasks(user_id);

grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;

alter table public.tasks enable row level security;
drop policy if exists "tasks_owner_all" on public.tasks;
create policy "tasks_owner_all" on public.tasks
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- TASK COMPLETIONS -------------------------------------------
create table if not exists public.task_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, task_id, date)
);
create index if not exists task_completions_user_date_idx on public.task_completions(user_id, date);

grant select, insert, update, delete on public.task_completions to authenticated;
grant all on public.task_completions to service_role;

alter table public.task_completions enable row level security;
drop policy if exists "task_completions_owner_all" on public.task_completions;
create policy "task_completions_owner_all" on public.task_completions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- TASK EXCEPTIONS --------------------------------------------
create table if not exists public.task_exceptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  date date not null,
  patch jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id, date)
);
create index if not exists task_exceptions_user_date_idx on public.task_exceptions(user_id, date);

grant select, insert, update, delete on public.task_exceptions to authenticated;
grant all on public.task_exceptions to service_role;

alter table public.task_exceptions enable row level security;
drop policy if exists "task_exceptions_owner_all" on public.task_exceptions;
create policy "task_exceptions_owner_all" on public.task_exceptions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- ROUTINE ARCHIVES -------------------------------------------
create table if not exists public.routine_archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  archived_at timestamptz not null default now(),
  tasks jsonb not null default '[]'::jsonb,
  done int not null default 0,
  total int not null default 0
);
create index if not exists routine_archives_user_date_idx on public.routine_archives(user_id, date_key);

grant select, insert, update, delete on public.routine_archives to authenticated;
grant all on public.routine_archives to service_role;

alter table public.routine_archives enable row level security;
drop policy if exists "routine_archives_owner_all" on public.routine_archives;
create policy "routine_archives_owner_all" on public.routine_archives
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- MISSIONS ---------------------------------------------------
create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  priority int not null default 2,
  days int not null default 1,
  start_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists missions_user_idx on public.missions(user_id);

grant select, insert, update, delete on public.missions to authenticated;
grant all on public.missions to service_role;

alter table public.missions enable row level security;
drop policy if exists "missions_owner_all" on public.missions;
create policy "missions_owner_all" on public.missions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- MISSION TASKS ---------------------------------------------
create table if not exists public.mission_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  day int not null default 1,
  title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists mission_tasks_mission_idx on public.mission_tasks(mission_id);
create index if not exists mission_tasks_user_idx on public.mission_tasks(user_id);

grant select, insert, update, delete on public.mission_tasks to authenticated;
grant all on public.mission_tasks to service_role;

alter table public.mission_tasks enable row level security;
drop policy if exists "mission_tasks_owner_all" on public.mission_tasks;
create policy "mission_tasks_owner_all" on public.mission_tasks
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- STREAK STATE ----------------------------------------------
create table if not exists public.streak_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak int not null default 0,
  last_completed_date date,
  last_reset_date date,
  last_evaluated_date date,
  last_broken_at timestamptz,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.streak_state to authenticated;
grant all on public.streak_state to service_role;

alter table public.streak_state enable row level security;
drop policy if exists "streak_state_owner_all" on public.streak_state;
create policy "streak_state_owner_all" on public.streak_state
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
