-- Interview RAG v1 schema

create table if not exists public.question_assets (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  question_type text not null,
  role_family text not null default 'general',
  seniority text not null default 'junior',
  topics text[] not null default '{}',
  difficulty integer not null default 3,
  expected_signals text[] not null default '{}',
  good_answer_rubric text[] not null default '{}',
  bad_answer_patterns text[] not null default '{}',
  follow_up_templates jsonb not null default '{}'::jsonb,
  source_type text not null default 'manual',
  source_ref text,
  quality_score numeric(4,2) not null default 0.70,
  language text not null default 'zh',
  company_tag text,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_question_assets_role_family on public.question_assets(role_family);
create index if not exists idx_question_assets_question_type on public.question_assets(question_type);
create index if not exists idx_question_assets_seniority on public.question_assets(seniority);
create index if not exists idx_question_assets_company_tag on public.question_assets(company_tag);
create index if not exists idx_question_assets_search_vector on public.question_assets using gin(search_vector);

create or replace function public.refresh_question_asset_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    to_tsvector(
      'simple',
      coalesce(new.question_text, '') || ' ' || array_to_string(coalesce(new.topics, '{}'), ' ')
    );
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_refresh_question_asset_search_vector on public.question_assets;
create trigger trg_refresh_question_asset_search_vector
before insert or update of question_text, topics
on public.question_assets
for each row
execute function public.refresh_question_asset_search_vector();

update public.question_assets
set search_vector =
  to_tsvector(
    'simple',
    coalesce(question_text, '') || ' ' || array_to_string(coalesce(topics, '{}'), ' ')
  )
where search_vector is null;

alter table public.question_assets enable row level security;

drop policy if exists "Authenticated users can view question assets" on public.question_assets;
create policy "Authenticated users can view question assets"
  on public.question_assets for select
  using (auth.role() = 'authenticated');

create table if not exists public.interviewer_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null default 'global',
  tone text not null default 'professional',
  depth_preference integer not null default 3,
  algorithm_weight integer not null default 2,
  project_weight integer not null default 4,
  behavior_weight integer not null default 2,
  follow_up_style text not null default 'balanced',
  role_family text,
  company_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.interviewer_profiles enable row level security;

drop policy if exists "Authenticated users can view interviewer profiles" on public.interviewer_profiles;
create policy "Authenticated users can view interviewer profiles"
  on public.interviewer_profiles for select
  using (auth.role() = 'authenticated');

create table if not exists public.interview_plans (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references public.interviews(id) on delete cascade,
  summary text not null default '',
  candidate_profile jsonb not null default '{}'::jsonb,
  interviewer_profile_id uuid references public.interviewer_profiles(id) on delete set null,
  planned_topics text[] not null default '{}',
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_interview_plans_interview_id on public.interview_plans(interview_id);

alter table public.interview_plans enable row level security;

drop policy if exists "Users can view own interview plans" on public.interview_plans;
create policy "Users can view own interview plans"
  on public.interview_plans for select
  using (
    exists (
      select 1
      from public.interviews i
      join public.user_profiles up on up.id = i.user_id
      where i.id = interview_id and up.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own interview plans" on public.interview_plans;
create policy "Users can insert own interview plans"
  on public.interview_plans for insert
  with check (
    exists (
      select 1
      from public.interviews i
      join public.user_profiles up on up.id = i.user_id
      where i.id = interview_id and up.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own interview plans" on public.interview_plans;
create policy "Users can update own interview plans"
  on public.interview_plans for update
  using (
    exists (
      select 1
      from public.interviews i
      join public.user_profiles up on up.id = i.user_id
      where i.id = interview_id and up.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.interviews i
      join public.user_profiles up on up.id = i.user_id
      where i.id = interview_id and up.user_id = auth.uid()
    )
  );

create table if not exists public.candidate_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  turn_id text not null,
  mastery_by_topic jsonb not null default '{}'::jsonb,
  risk_flags text[] not null default '{}',
  coverage_status jsonb not null default '{}'::jsonb,
  recommended_next_action text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_candidate_state_snapshots_interview_id on public.candidate_state_snapshots(interview_id);

alter table public.candidate_state_snapshots enable row level security;

drop policy if exists "Users can view own candidate state snapshots" on public.candidate_state_snapshots;
create policy "Users can view own candidate state snapshots"
  on public.candidate_state_snapshots for select
  using (
    exists (
      select 1
      from public.interviews i
      join public.user_profiles up on up.id = i.user_id
      where i.id = interview_id and up.user_id = auth.uid()
    )
  );

create table if not exists public.interview_decisions (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  turn_id text not null,
  selected_question_id uuid references public.question_assets(id) on delete set null,
  retrieval_evidence jsonb not null default '[]'::jsonb,
  decision_type text not null,
  decision_reason text not null,
  alternative_candidates text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_interview_decisions_interview_id on public.interview_decisions(interview_id);

alter table public.interview_decisions enable row level security;

drop policy if exists "Users can view own interview decisions" on public.interview_decisions;
create policy "Users can view own interview decisions"
  on public.interview_decisions for select
  using (
    exists (
      select 1
      from public.interviews i
      join public.user_profiles up on up.id = i.user_id
      where i.id = interview_id and up.user_id = auth.uid()
    )
  );

alter table public.interview_evaluations
  add column if not exists question_asset_id uuid references public.question_assets(id) on delete set null,
  add column if not exists expected_signals text[] not null default '{}',
  add column if not exists detected_signals text[] not null default '{}',
  add column if not exists missing_signals text[] not null default '{}',
  add column if not exists risk_flags text[] not null default '{}',
  add column if not exists answer_span_refs jsonb not null default '[]'::jsonb,
  add column if not exists confidence numeric(4,2),
  add column if not exists follow_up_reason text;
