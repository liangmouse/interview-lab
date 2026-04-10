create table if not exists public.coding_interview_sessions (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references public.interviews(id) on delete cascade,
  generation_source text not null default 'llm',
  problems jsonb not null default '[]'::jsonb,
  draft_state jsonb not null default '{"activeProblemIndex":0,"activeTab":"solution","filesByProblem":{},"resultsByProblem":{}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coding_interview_sessions_generation_source_check
    check (generation_source in ('llm', 'fallback', 'timeout-fallback')),
  constraint coding_interview_sessions_problems_is_array_check
    check (jsonb_typeof(problems) = 'array'),
  constraint coding_interview_sessions_draft_state_is_object_check
    check (jsonb_typeof(draft_state) = 'object')
);

create index if not exists idx_coding_interview_sessions_interview_id
  on public.coding_interview_sessions(interview_id);

alter table public.coding_interview_sessions enable row level security;

drop policy if exists "Users can view own coding interview sessions"
  on public.coding_interview_sessions;
create policy "Users can view own coding interview sessions"
  on public.coding_interview_sessions for select
  using (
    exists (
      select 1
      from public.interviews i
      where i.id = coding_interview_sessions.interview_id
        and i.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own coding interview sessions"
  on public.coding_interview_sessions;
create policy "Users can insert own coding interview sessions"
  on public.coding_interview_sessions for insert
  with check (
    exists (
      select 1
      from public.interviews i
      where i.id = coding_interview_sessions.interview_id
        and i.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own coding interview sessions"
  on public.coding_interview_sessions;
create policy "Users can update own coding interview sessions"
  on public.coding_interview_sessions for update
  using (
    exists (
      select 1
      from public.interviews i
      where i.id = coding_interview_sessions.interview_id
        and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.interviews i
      where i.id = coding_interview_sessions.interview_id
        and i.user_id = auth.uid()
    )
  );
