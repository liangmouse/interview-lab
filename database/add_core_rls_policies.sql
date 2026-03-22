do $$
begin
  if to_regclass('public.user_profiles') is not null then
    execute 'alter table public.user_profiles enable row level security';
    execute 'drop policy if exists "Users can view own profile" on public.user_profiles';
    execute 'create policy "Users can view own profile" on public.user_profiles for select using (auth.uid() = user_id)';
    execute 'drop policy if exists "Users can insert own profile" on public.user_profiles';
    execute 'create policy "Users can insert own profile" on public.user_profiles for insert with check (auth.uid() = user_id)';
    execute 'drop policy if exists "Users can update own profile" on public.user_profiles';
    execute 'create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
    execute 'drop policy if exists "Users can delete own profile" on public.user_profiles';
    execute 'create policy "Users can delete own profile" on public.user_profiles for delete using (auth.uid() = user_id)';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.interviews') is not null then
    execute 'alter table public.interviews enable row level security';
    execute 'drop policy if exists "Users can view own interviews" on public.interviews';
    execute $sql$
      create policy "Users can view own interviews"
      on public.interviews
      for select
      using (
        exists (
          select 1
          from public.user_profiles
          where user_profiles.id = interviews.user_id
            and user_profiles.user_id = auth.uid()
        )
      )
    $sql$;
    execute 'drop policy if exists "Users can insert own interviews" on public.interviews';
    execute $sql$
      create policy "Users can insert own interviews"
      on public.interviews
      for insert
      with check (
        exists (
          select 1
          from public.user_profiles
          where user_profiles.id = interviews.user_id
            and user_profiles.user_id = auth.uid()
        )
      )
    $sql$;
    execute 'drop policy if exists "Users can update own interviews" on public.interviews';
    execute $sql$
      create policy "Users can update own interviews"
      on public.interviews
      for update
      using (
        exists (
          select 1
          from public.user_profiles
          where user_profiles.id = interviews.user_id
            and user_profiles.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.user_profiles
          where user_profiles.id = interviews.user_id
            and user_profiles.user_id = auth.uid()
        )
      )
    $sql$;
    execute 'drop policy if exists "Users can delete own interviews" on public.interviews';
    execute $sql$
      create policy "Users can delete own interviews"
      on public.interviews
      for delete
      using (
        exists (
          select 1
          from public.user_profiles
          where user_profiles.id = interviews.user_id
            and user_profiles.user_id = auth.uid()
        )
      )
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.resumes') is not null then
    execute 'alter table public.resumes enable row level security';
    execute 'drop policy if exists "Users can view own resumes" on public.resumes';
    execute $sql$
      create policy "Users can view own resumes"
      on public.resumes
      for select
      using (
        exists (
          select 1
          from public.user_profiles
          where user_profiles.id = resumes.user_id
            and user_profiles.user_id = auth.uid()
        )
      )
    $sql$;
    execute 'drop policy if exists "Users can insert own resumes" on public.resumes';
    execute $sql$
      create policy "Users can insert own resumes"
      on public.resumes
      for insert
      with check (
        exists (
          select 1
          from public.user_profiles
          where user_profiles.id = resumes.user_id
            and user_profiles.user_id = auth.uid()
        )
      )
    $sql$;
    execute 'drop policy if exists "Users can update own resumes" on public.resumes';
    execute $sql$
      create policy "Users can update own resumes"
      on public.resumes
      for update
      using (
        exists (
          select 1
          from public.user_profiles
          where user_profiles.id = resumes.user_id
            and user_profiles.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.user_profiles
          where user_profiles.id = resumes.user_id
            and user_profiles.user_id = auth.uid()
        )
      )
    $sql$;
    execute 'drop policy if exists "Users can delete own resumes" on public.resumes';
    execute $sql$
      create policy "Users can delete own resumes"
      on public.resumes
      for delete
      using (
        exists (
          select 1
          from public.user_profiles
          where user_profiles.id = resumes.user_id
            and user_profiles.user_id = auth.uid()
        )
      )
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.interview_evaluations') is not null then
    execute 'alter table public.interview_evaluations enable row level security';
    execute 'drop policy if exists "Users can view own interview evaluations" on public.interview_evaluations';
    execute $sql$
      create policy "Users can view own interview evaluations"
      on public.interview_evaluations
      for select
      using (
        exists (
          select 1
          from public.interviews
          join public.user_profiles on user_profiles.id = interviews.user_id
          where interviews.id = interview_evaluations.interview_id
            and user_profiles.user_id = auth.uid()
        )
      )
    $sql$;
    execute 'drop policy if exists "Users can insert own interview evaluations" on public.interview_evaluations';
    execute $sql$
      create policy "Users can insert own interview evaluations"
      on public.interview_evaluations
      for insert
      with check (
        exists (
          select 1
          from public.interviews
          join public.user_profiles on user_profiles.id = interviews.user_id
          where interviews.id = interview_evaluations.interview_id
            and user_profiles.user_id = auth.uid()
        )
      )
    $sql$;
    execute 'drop policy if exists "Users can update own interview evaluations" on public.interview_evaluations';
    execute $sql$
      create policy "Users can update own interview evaluations"
      on public.interview_evaluations
      for update
      using (
        exists (
          select 1
          from public.interviews
          join public.user_profiles on user_profiles.id = interviews.user_id
          where interviews.id = interview_evaluations.interview_id
            and user_profiles.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.interviews
          join public.user_profiles on user_profiles.id = interviews.user_id
          where interviews.id = interview_evaluations.interview_id
            and user_profiles.user_id = auth.uid()
        )
      )
    $sql$;
    execute 'drop policy if exists "Users can delete own interview evaluations" on public.interview_evaluations';
    execute $sql$
      create policy "Users can delete own interview evaluations"
      on public.interview_evaluations
      for delete
      using (
        exists (
          select 1
          from public.interviews
          join public.user_profiles on user_profiles.id = interviews.user_id
          where interviews.id = interview_evaluations.interview_id
            and user_profiles.user_id = auth.uid()
        )
      )
    $sql$;
  end if;
end
$$;
