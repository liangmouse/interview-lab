create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trial_total integer not null default 3,
  trial_used integer not null default 0,
  current_tier text not null default 'free',
  premium_expires_at timestamptz,
  cancel_at_period_end boolean not null default false,
  active_subscription_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  plan_key text not null,
  provider_subscription_id text unique,
  provider_customer_id text,
  status text not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  plan_key text not null,
  checkout_method text not null,
  status text not null default 'pending',
  currency text not null default 'cny',
  amount_cents integer not null default 0,
  provider_order_id text unique,
  provider_subscription_id text,
  checkout_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

alter table public.user_entitlements enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_orders enable row level security;
alter table public.billing_webhook_events enable row level security;

drop policy if exists "Users can view own entitlements" on public.user_entitlements;
create policy "Users can view own entitlements"
  on public.user_entitlements for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own entitlements" on public.user_entitlements;
create policy "Users can insert own entitlements"
  on public.user_entitlements for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own entitlements" on public.user_entitlements;
create policy "Users can update own entitlements"
  on public.user_entitlements for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own subscriptions" on public.billing_subscriptions;
create policy "Users can view own subscriptions"
  on public.billing_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can view own orders" on public.billing_orders;
create policy "Users can view own orders"
  on public.billing_orders for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own orders" on public.billing_orders;
create policy "Users can insert own orders"
  on public.billing_orders for insert
  with check (auth.uid() = user_id);

alter table public.user_entitlements
  drop constraint if exists user_entitlements_active_subscription_id_fkey;

alter table public.user_entitlements
  add constraint user_entitlements_active_subscription_id_fkey
  foreign key (active_subscription_id)
  references public.billing_subscriptions(id)
  on delete set null;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_entitlements_updated_at on public.user_entitlements;
create trigger trg_user_entitlements_updated_at
before update on public.user_entitlements
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_billing_subscriptions_updated_at on public.billing_subscriptions;
create trigger trg_billing_subscriptions_updated_at
before update on public.billing_subscriptions
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_billing_orders_updated_at on public.billing_orders;
create trigger trg_billing_orders_updated_at
before update on public.billing_orders
for each row execute procedure public.set_updated_at();

create or replace function public.consume_trial_if_available(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  entitlement_row public.user_entitlements%rowtype;
begin
  insert into public.user_entitlements (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into entitlement_row
  from public.user_entitlements
  where user_id = p_user_id
  for update;

  if entitlement_row.current_tier = 'premium'
     and entitlement_row.premium_expires_at is not null
     and entitlement_row.premium_expires_at > now() then
    return jsonb_build_object(
      'allowed', true,
      'trialRemaining', greatest(entitlement_row.trial_total - entitlement_row.trial_used, 0),
      'tier', 'premium'
    );
  end if;

  if entitlement_row.trial_used >= entitlement_row.trial_total then
    return jsonb_build_object(
      'allowed', false,
      'trialRemaining', 0,
      'tier', 'free'
    );
  end if;

  update public.user_entitlements
  set trial_used = entitlement_row.trial_used + 1
  where user_id = p_user_id;

  return jsonb_build_object(
    'allowed', true,
    'trialRemaining', greatest(entitlement_row.trial_total - entitlement_row.trial_used - 1, 0),
    'tier', 'free'
  );
end;
$$;

create or replace function public.get_user_access_state(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  entitlement_row public.user_entitlements%rowtype;
  tier text := 'free';
  subscription_status text := 'inactive';
begin
  insert into public.user_entitlements (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into entitlement_row
  from public.user_entitlements
  where user_id = p_user_id;

  if entitlement_row.current_tier = 'premium'
     and entitlement_row.premium_expires_at is not null
     and entitlement_row.premium_expires_at > now() then
    tier := 'premium';
    subscription_status := 'active';
  elsif entitlement_row.current_tier = 'premium' then
    subscription_status := 'expired';
  end if;

  return jsonb_build_object(
    'tier', tier,
    'trialTotal', entitlement_row.trial_total,
    'trialUsed', entitlement_row.trial_used,
    'trialRemaining', greatest(entitlement_row.trial_total - entitlement_row.trial_used, 0),
    'canUsePersonalization', tier = 'premium',
    'canViewFullReport', tier = 'premium',
    'subscriptionStatus', subscription_status,
    'currentPeriodEnd', entitlement_row.premium_expires_at,
    'cancelAtPeriodEnd', entitlement_row.cancel_at_period_end,
    'activeSubscriptionId', entitlement_row.active_subscription_id
  );
end;
$$;

create or replace function public.compensate_trial_consumption(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  entitlement_row public.user_entitlements%rowtype;
begin
  select * into entitlement_row
  from public.user_entitlements
  where user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'trialUsed', 0);
  end if;

  update public.user_entitlements
  set trial_used = greatest(entitlement_row.trial_used - 1, 0)
  where user_id = p_user_id;

  return jsonb_build_object(
    'success', true,
    'trialUsed', greatest(entitlement_row.trial_used - 1, 0)
  );
end;
$$;
