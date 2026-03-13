create table if not exists public.user_oauth_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  profile_id text not null,
  credential jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider),
  unique (profile_id)
);

alter table public.user_oauth_credentials enable row level security;

drop policy if exists "Users can view own oauth credentials" on public.user_oauth_credentials;
create policy "Users can view own oauth credentials"
  on public.user_oauth_credentials for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own oauth credentials" on public.user_oauth_credentials;
create policy "Users can insert own oauth credentials"
  on public.user_oauth_credentials for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own oauth credentials" on public.user_oauth_credentials;
create policy "Users can update own oauth credentials"
  on public.user_oauth_credentials for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own oauth credentials" on public.user_oauth_credentials;
create policy "Users can delete own oauth credentials"
  on public.user_oauth_credentials for delete
  using (auth.uid() = user_id);

drop trigger if exists trg_user_oauth_credentials_updated_at on public.user_oauth_credentials;
create trigger trg_user_oauth_credentials_updated_at
before update on public.user_oauth_credentials
for each row execute procedure public.set_updated_at();
