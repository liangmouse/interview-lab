alter table public.resumes
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists parsed_json jsonb,
  add column if not exists processing_status text not null default 'uploaded',
  add column if not exists last_processed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_resumes_storage_path on public.resumes(storage_path);
create index if not exists idx_resumes_user_storage_path on public.resumes(user_id, storage_path);

create table if not exists public.resume_review_jobs (
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

create index if not exists idx_resume_review_jobs_user_id on public.resume_review_jobs(user_id);
create index if not exists idx_resume_review_jobs_status_available_at on public.resume_review_jobs(status, available_at, created_at);

alter table public.resume_review_jobs enable row level security;

drop policy if exists "Users can view own resume review jobs" on public.resume_review_jobs;
create policy "Users can view own resume review jobs"
  on public.resume_review_jobs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own resume review jobs" on public.resume_review_jobs;
create policy "Users can insert own resume review jobs"
  on public.resume_review_jobs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own resume review jobs" on public.resume_review_jobs;
create policy "Users can update own resume review jobs"
  on public.resume_review_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.questioning_jobs (
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

create index if not exists idx_questioning_jobs_user_id on public.questioning_jobs(user_id);
create index if not exists idx_questioning_jobs_status_available_at on public.questioning_jobs(status, available_at, created_at);

alter table public.questioning_jobs enable row level security;

drop policy if exists "Users can view own questioning jobs" on public.questioning_jobs;
create policy "Users can view own questioning jobs"
  on public.questioning_jobs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own questioning jobs" on public.questioning_jobs;
create policy "Users can insert own questioning jobs"
  on public.questioning_jobs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own questioning jobs" on public.questioning_jobs;
create policy "Users can update own questioning jobs"
  on public.questioning_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
