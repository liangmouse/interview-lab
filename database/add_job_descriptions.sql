-- Job Description data model + interview binding

create table if not exists public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  source_type text not null default 'manual', -- manual | upload
  source_file_url text,
  raw_text text not null,
  summary text,
  experience_level text,
  keywords text[] not null default '{}',
  requirements jsonb not null default '[]'::jsonb,
  responsibilities jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_descriptions_user_id on public.job_descriptions(user_id);
create index if not exists idx_job_descriptions_created_at on public.job_descriptions(created_at desc);

alter table public.job_descriptions enable row level security;

drop policy if exists "Users can view own job descriptions" on public.job_descriptions;
create policy "Users can view own job descriptions"
  on public.job_descriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own job descriptions" on public.job_descriptions;
create policy "Users can insert own job descriptions"
  on public.job_descriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own job descriptions" on public.job_descriptions;
create policy "Users can update own job descriptions"
  on public.job_descriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own job descriptions" on public.job_descriptions;
create policy "Users can delete own job descriptions"
  on public.job_descriptions for delete
  using (auth.uid() = user_id);

-- link JD to interview session snapshot
alter table public.interviews
  add column if not exists job_description_id uuid references public.job_descriptions(id) on delete set null;

create index if not exists idx_interviews_job_description_id on public.interviews(job_description_id);
