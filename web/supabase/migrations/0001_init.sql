-- ============================================================
-- WashLoop — Schema iniziale
-- Postgres / Supabase. RLS attiva su tutte le tabelle dati.
-- ============================================================

-- ---------- ENUMS ----------
create type user_role as enum ('customer', 'courier', 'partner', 'admin');

create type order_status as enum (
  'requested',
  'pickup_scheduled',
  'picked_up',
  'at_laundry',
  'washing',
  'ready',
  'delivery_scheduled',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled'
);

create type item_status as enum ('received', 'washing', 'ready', 'issue');
create type slot_kind as enum ('pickup', 'delivery');

-- ---------- TABLES ----------

-- Profilo 1:1 con auth.users
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null default 'customer',
  full_name text,
  phone text,
  laundry_id uuid, -- solo per role = partner (FK aggiunta dopo laundries)
  created_at timestamptz not null default now()
);

create table zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default 'Milano',
  active boolean not null default true
);

create table laundries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  zone_id uuid references zones,
  address text,
  active boolean not null default true
);

alter table profiles
  add constraint profiles_laundry_fk foreign key (laundry_id) references laundries on delete set null;

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  label text,
  street text not null,
  zone_id uuid references zones,
  intercom text,
  floor text,
  notes text,
  created_at timestamptz not null default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  price_month_cents int not null,
  pickups_per_week int not null default 1,
  stripe_price_id text,
  active boolean not null default true,
  sort int not null default 0
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  plan_id uuid references plans,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'incomplete',
  founder_pricing boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table slots (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references zones,
  kind slot_kind not null default 'pickup',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int not null default 10
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles on delete cascade,
  address_id uuid references addresses,
  status order_status not null default 'requested',
  pickup_slot_id uuid references slots,
  delivery_slot_id uuid references slots,
  courier_id uuid references profiles,
  laundry_id uuid references laundries,
  bags int not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  kind text,
  status item_status not null default 'received',
  photo_url text,
  created_at timestamptz not null default now()
);

create table order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  status order_status not null,
  note text,
  actor_id uuid references profiles,
  created_at timestamptz not null default now()
);

create index on addresses (user_id);
create index on orders (customer_id);
create index on orders (courier_id);
create index on orders (laundry_id);
create index on orders (status);
create index on order_items (order_id);
create index on order_events (order_id);
create index on slots (zone_id, kind, starts_at);

-- ---------- HELPER FUNCTIONS (security definer, evitano ricorsione RLS) ----------

create or replace function auth_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false);
$$;

create or replace function my_laundry_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select laundry_id from profiles where id = auth.uid();
$$;

-- ---------- TRIGGERS ----------

-- Crea profilo automaticamente alla registrazione
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Aggiorna updated_at + registra evento al cambio stato ordine
create or replace function orders_touch_and_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if (tg_op = 'INSERT') or (new.status is distinct from old.status) then
    insert into order_events (order_id, status, actor_id)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger orders_after_change
  after insert on orders
  for each row execute function orders_touch_and_log();

create trigger orders_before_update
  before update on orders
  for each row execute function orders_touch_and_log();

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table zones enable row level security;
alter table laundries enable row level security;
alter table addresses enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table slots enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_events enable row level security;

-- profiles: ognuno vede/aggiorna il proprio; admin tutto
create policy "profiles self read" on profiles for select using (id = auth.uid() or is_admin());
create policy "profiles self update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin all" on profiles for all using (is_admin()) with check (is_admin());

-- cataloghi pubblici in lettura, scrittura solo admin
create policy "zones read" on zones for select using (true);
create policy "zones admin" on zones for all using (is_admin()) with check (is_admin());
create policy "laundries read" on laundries for select using (true);
create policy "laundries admin" on laundries for all using (is_admin()) with check (is_admin());
create policy "plans read" on plans for select using (true);
create policy "plans admin" on plans for all using (is_admin()) with check (is_admin());
create policy "slots read" on slots for select using (true);
create policy "slots admin" on slots for all using (is_admin()) with check (is_admin());

-- addresses: proprietario; admin; corriere se collegato a un ordine assegnato
create policy "addresses owner" on addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "addresses admin" on addresses for select using (is_admin());
create policy "addresses courier" on addresses for select using (
  exists (select 1 from orders o where o.address_id = addresses.id and o.courier_id = auth.uid())
);

-- subscriptions: proprietario in lettura; admin tutto. Scrittura via service-role (webhook Stripe).
create policy "subs owner read" on subscriptions for select using (user_id = auth.uid() or is_admin());
create policy "subs admin write" on subscriptions for all using (is_admin()) with check (is_admin());

-- orders: cliente (propri), corriere (assegnati), partner (sua lavanderia), admin
create policy "orders customer read" on orders for select using (customer_id = auth.uid());
create policy "orders customer insert" on orders for insert with check (customer_id = auth.uid());
create policy "orders customer update" on orders for update
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "orders courier" on orders for select using (courier_id = auth.uid());
create policy "orders courier update" on orders for update
  using (courier_id = auth.uid()) with check (courier_id = auth.uid());
create policy "orders partner" on orders for select using (laundry_id = my_laundry_id());
create policy "orders partner update" on orders for update
  using (laundry_id = my_laundry_id()) with check (laundry_id = my_laundry_id());
create policy "orders admin" on orders for all using (is_admin()) with check (is_admin());

-- helper: l'utente può vedere l'ordine?
create or replace function can_see_order(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from orders o
    where o.id = oid and (
      o.customer_id = auth.uid()
      or o.courier_id = auth.uid()
      or o.laundry_id = my_laundry_id()
      or is_admin()
    )
  );
$$;

-- order_items / order_events: visibili a chi vede l'ordine
create policy "items read" on order_items for select using (can_see_order(order_id));
create policy "items staff write" on order_items for all
  using (can_see_order(order_id) and auth_role() in ('courier','partner','admin'))
  with check (can_see_order(order_id) and auth_role() in ('courier','partner','admin'));

create policy "events read" on order_events for select using (can_see_order(order_id));
create policy "events staff insert" on order_events for insert
  with check (can_see_order(order_id));
