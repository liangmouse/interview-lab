create table if not exists public.resume_generation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_resume_storage_path text not null,
  direction_preset text not null,
  custom_style_prompt text,
  language text not null,
  session_status text not null default 'collecting',
  portrait_draft jsonb not null default '{}'::jsonb,
  missing_fields text[] not null default '{}'::text[],
  assistant_question text,
  suggested_answer_hints text[] not null default '{}'::text[],
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_resume_generation_sessions_user_id
  on public.resume_generation_sessions(user_id);
create index if not exists idx_resume_generation_sessions_status
  on public.resume_generation_sessions(user_id, session_status, created_at desc);

alter table public.resume_generation_sessions enable row level security;

drop policy if exists "Users can view own resume generation sessions" on public.resume_generation_sessions;
create policy "Users can view own resume generation sessions"
  on public.resume_generation_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own resume generation sessions" on public.resume_generation_sessions;
create policy "Users can insert own resume generation sessions"
  on public.resume_generation_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own resume generation sessions" on public.resume_generation_sessions;
create policy "Users can update own resume generation sessions"
  on public.resume_generation_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.resume_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  status text not null default 'queued',
  error_message text,
  provider_id text,
  model text,
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_resume_generation_jobs_user_id
  on public.resume_generation_jobs(user_id);
create index if not exists idx_resume_generation_jobs_status_available_at
  on public.resume_generation_jobs(status, available_at, created_at);

alter table public.resume_generation_jobs enable row level security;

drop policy if exists "Users can view own resume generation jobs" on public.resume_generation_jobs;
create policy "Users can view own resume generation jobs"
  on public.resume_generation_jobs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own resume generation jobs" on public.resume_generation_jobs;
create policy "Users can insert own resume generation jobs"
  on public.resume_generation_jobs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own resume generation jobs" on public.resume_generation_jobs;
create policy "Users can update own resume generation jobs"
  on public.resume_generation_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.resume_generation_sessions(id) on delete set null,
  source_resume_storage_path text not null,
  direction_preset text not null,
  custom_style_prompt text,
  language text not null,
  title text not null,
  summary text not null,
  preview_slug text not null,
  markdown_storage_path text not null,
  markdown_content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_resume_versions_user_id
  on public.resume_versions(user_id);
create unique index if not exists idx_resume_versions_preview_slug
  on public.resume_versions(preview_slug);

alter table public.resume_versions enable row level security;

drop policy if exists "Users can view own resume versions" on public.resume_versions;
create policy "Users can view own resume versions"
  on public.resume_versions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own resume versions" on public.resume_versions;
create policy "Users can insert own resume versions"
  on public.resume_versions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own resume versions" on public.resume_versions;
create policy "Users can update own resume versions"
  on public.resume_versions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
