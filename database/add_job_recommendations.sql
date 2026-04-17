alter table public.user_profiles
  add column if not exists job_search_preferences jsonb;

create table if not exists public.job_source_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  credential jsonb not null default '{}'::jsonb,
  status text not null default 'connected',
  validation_error text,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source)
);

create index if not exists idx_job_source_sessions_user_id
  on public.job_source_sessions(user_id);

alter table public.job_source_sessions enable row level security;

drop policy if exists "Users can view own job source sessions" on public.job_source_sessions;
create policy "Users can view own job source sessions"
  on public.job_source_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own job source sessions" on public.job_source_sessions;
create policy "Users can insert own job source sessions"
  on public.job_source_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own job source sessions" on public.job_source_sessions;
create policy "Users can update own job source sessions"
  on public.job_source_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own job source sessions" on public.job_source_sessions;
create policy "Users can delete own job source sessions"
  on public.job_source_sessions for delete
  using (auth.uid() = user_id);

drop trigger if exists trg_job_source_sessions_updated_at on public.job_source_sessions;
create trigger trg_job_source_sessions_updated_at
before update on public.job_source_sessions
for each row execute procedure public.set_updated_at();

create table if not exists public.job_recommendation_jobs (
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

create index if not exists idx_job_recommendation_jobs_user_id
  on public.job_recommendation_jobs(user_id);
create index if not exists idx_job_recommendation_jobs_status_available_at
  on public.job_recommendation_jobs(status, available_at, created_at);

alter table public.job_recommendation_jobs enable row level security;

drop policy if exists "Users can view own job recommendation jobs" on public.job_recommendation_jobs;
create policy "Users can view own job recommendation jobs"
  on public.job_recommendation_jobs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own job recommendation jobs" on public.job_recommendation_jobs;
create policy "Users can insert own job recommendation jobs"
  on public.job_recommendation_jobs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own job recommendation jobs" on public.job_recommendation_jobs;
create policy "Users can update own job recommendation jobs"
  on public.job_recommendation_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists trg_job_recommendation_jobs_updated_at on public.job_recommendation_jobs;
create trigger trg_job_recommendation_jobs_updated_at
before update on public.job_recommendation_jobs
for each row execute procedure public.set_updated_at();

create table if not exists public.job_recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  source_job_id text not null,
  action text not null,
  job_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, source_job_id)
);

create index if not exists idx_job_recommendation_feedback_user_id
  on public.job_recommendation_feedback(user_id);
create index if not exists idx_job_recommendation_feedback_action
  on public.job_recommendation_feedback(action);

alter table public.job_recommendation_feedback enable row level security;

drop policy if exists "Users can view own job recommendation feedback" on public.job_recommendation_feedback;
create policy "Users can view own job recommendation feedback"
  on public.job_recommendation_feedback for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own job recommendation feedback" on public.job_recommendation_feedback;
create policy "Users can insert own job recommendation feedback"
  on public.job_recommendation_feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own job recommendation feedback" on public.job_recommendation_feedback;
create policy "Users can update own job recommendation feedback"
  on public.job_recommendation_feedback for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own job recommendation feedback" on public.job_recommendation_feedback;
create policy "Users can delete own job recommendation feedback"
  on public.job_recommendation_feedback for delete
  using (auth.uid() = user_id);

drop trigger if exists trg_job_recommendation_feedback_updated_at on public.job_recommendation_feedback;
create trigger trg_job_recommendation_feedback_updated_at
before update on public.job_recommendation_feedback
for each row execute procedure public.set_updated_at();
