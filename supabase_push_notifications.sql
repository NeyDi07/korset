create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  auth_user_id uuid null,
  device_id text null,
  store_slug text null,
  preferences jsonb not null default '{}'::jsonb,
  user_agent text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text not null,
  status text not null default 'pending',
  deliveries_total integer not null default 0,
  deliveries_success integer not null default 0,
  deliveries_failed integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid null references public.notification_events(id) on delete set null,
  endpoint text not null,
  status text not null,
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_auth_user on public.push_subscriptions(auth_user_id);
create index if not exists idx_push_subscriptions_device on public.push_subscriptions(device_id);
create index if not exists idx_push_subscriptions_active on public.push_subscriptions(is_active);
create index if not exists idx_notification_events_type on public.notification_events(type);

alter table public.push_subscriptions enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;

-- Client напрямую в эти таблицы не ходит, всё идёт через server routes/service role.
-- Поэтому открытых policy здесь не даём.
