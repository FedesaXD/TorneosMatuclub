-- ================================================================
-- BRAWLARENA — SUPABASE DATABASE SCHEMA
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- PROFILES (extiende auth.users de Supabase)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nickname text unique not null,
  brawl_tag text unique not null,
  email text not null,
  screenshot_path text,
  is_admin boolean default false,
  is_verified boolean default false,
  created_at timestamptz default now()
);

-- TOURNAMENTS
create table if not exists public.tournaments (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  format text not null check (format in ('3v3', 'solo')),
  status text not null default 'pending' check (status in ('pending', 'upcoming', 'active', 'closed')),
  start_date timestamptz,
  max_teams int not null default 8,
  game_mode text,
  prize text,
  created_at timestamptz default now()
);

-- TEAMS
create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique(tournament_id, name)
);

-- TEAM MEMBERS
create table if not exists public.team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  is_captain boolean default false,
  created_at timestamptz default now(),
  unique(team_id, profile_id),
  unique(profile_id) -- a player can only be in one team at a time
);

-- MATCHES (bracket)
create table if not exists public.matches (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  round int not null,
  match_number int not null,
  team_a_id uuid references public.teams(id),
  team_b_id uuid references public.teams(id),
  winner_id uuid references public.teams(id),
  score_a int,
  score_b int,
  status text default 'waiting' check (status in ('waiting', 'pending', 'completed', 'bye')),
  created_at timestamptz default now()
);

-- MATCH RESULTS (submitted by players, reviewed by admin)
create table if not exists public.match_results (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade,
  submitted_by uuid references public.profiles(id),
  score_a int not null,
  score_b int not null,
  screenshot_path text,
  status text default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.matches enable row level security;
alter table public.match_results enable row level security;

-- PROFILES
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);

create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Admins can update any profile" on public.profiles
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- TOURNAMENTS
create policy "Tournaments are viewable by everyone" on public.tournaments
  for select using (true);

create policy "Only admins can insert tournaments" on public.tournaments
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "Only admins can update tournaments" on public.tournaments
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- TEAMS
create policy "Teams are viewable by everyone" on public.teams
  for select using (true);

create policy "Authenticated users can create teams" on public.teams
  for insert with check (auth.role() = 'authenticated');

-- TEAM MEMBERS
create policy "Team members are viewable by everyone" on public.team_members
  for select using (true);

create policy "Authenticated users can join teams" on public.team_members
  for insert with check (auth.uid() = profile_id);

-- MATCHES
create policy "Matches are viewable by everyone" on public.matches
  for select using (true);

create policy "Only admins can insert/update matches" on public.matches
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- MATCH RESULTS
create policy "Users can view match results" on public.match_results
  for select using (true);

create policy "Authenticated users can submit results" on public.match_results
  for insert with check (auth.uid() = submitted_by);

create policy "Admins can update match results" on public.match_results
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ================================================================
-- STORAGE
-- Crear en: Supabase Dashboard → Storage → New Bucket
-- Nombre: "screenshots", Private: true
-- ================================================================

-- Allow authenticated users to upload screenshots
insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', false)
on conflict do nothing;

create policy "Authenticated users can upload screenshots" on storage.objects
  for insert with check (bucket_id = 'screenshots' and auth.role() = 'authenticated');

create policy "Admins can view all screenshots" on storage.objects
  for select using (
    bucket_id = 'screenshots' and
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "Users can view their own screenshots" on storage.objects
  for select using (
    bucket_id = 'screenshots' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ================================================================
-- ADMIN SETUP
-- Después de registrarte con tu cuenta, ejecuta esto para hacerte admin:
-- REEMPLAZA 'TU_NICKNAME' con tu nickname
-- ================================================================

-- update public.profiles set is_admin = true where nickname = 'TU_NICKNAME';
