-- ============================================================
-- 0008 — Privacy partner (lavanderia)
-- La lavanderia vede SOLO il codice cliente anonimo (WL-xxxx).
-- Mai: nome, indirizzo, note, né il prezzo cliente (col. E).
-- Vede solo il proprio compenso (col. D) e la tariffa sacco.
--
-- Enforcement:
--   1) codice cliente stabile e anonimo su profiles
--   2) il partner NON legge più la base table `orders`/`order_specials`
--   3) accede solo via viste che proiettano colonne sicure
-- ============================================================

-- ---------- Codice cliente anonimo ----------
alter table profiles add column if not exists client_code text unique;

-- Genera un codice WL-#### non in uso (4 cifre, non sequenziale: non rivela
-- il numero di clienti).
create or replace function gen_client_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare c text;
begin
  loop
    c := 'WL-' || lpad((floor(random()*9000)+1000)::int::text, 4, '0');
    exit when not exists (select 1 from profiles where client_code = c);
  end loop;
  return c;
end $$;

-- Backfill clienti esistenti (uno alla volta per garantire l'unicità).
do $$
declare r record;
begin
  for r in select id from profiles where client_code is null loop
    update profiles set client_code = gen_client_code() where id = r.id;
  end loop;
end $$;

-- Assegna il codice alla registrazione.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, client_code)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    gen_client_code()
  );
  return new;
end $$;

-- ---------- Attributi ordine scelti dal cliente (visibili al partner) ----------
-- Servono al portale lavanderia; nessun dato personale.
alter table orders add column if not exists service   text;  -- es. 'Lavaggio + piega'
alter table orders add column if not exists fragrance text;  -- es. 'Lavanda'

-- ---------- Chiudi la base table al partner ----------
-- Il partner non deve poter leggere righe complete (notes, customer_id, ...).
-- La lettura passa esclusivamente dalle viste sicure qui sotto.
drop policy if exists "orders partner" on orders;
-- NB: "orders partner update" resta (avanzamento stato). Senza policy di
-- SELECT, un eventuale RETURNING di colonne sensibili è comunque negato.

-- order_specials: il partner SCRIVE (inserisce capi) ma NON legge la base
-- (conterrebbe price_cli_cents). Legge via vista partner_order_specials.
drop policy if exists "ospec staff write" on order_specials;
drop policy if exists "ospec read"        on order_specials;

create policy "ospec read" on order_specials for select
  using (can_see_order(order_id) and auth_role() in ('customer','admin'));

create policy "ospec partner insert" on order_specials for insert
  with check (can_see_order(order_id) and auth_role() = 'partner');
create policy "ospec partner update" on order_specials for update
  using (can_see_order(order_id) and auth_role() = 'partner')
  with check (can_see_order(order_id) and auth_role() = 'partner');

create policy "ospec admin" on order_specials for all
  using (is_admin()) with check (is_admin());

-- ============================================================
-- VISTE PARTNER (proiezione colonne sicure, filtrate per lavanderia)
-- Eseguite come owner (bypassano la RLS della base) ma filtrano sempre
-- su my_laundry_id() → ogni partner vede solo la propria lavanderia,
-- clienti/admin ottengono 0 righe.
-- ============================================================

create or replace view partner_orders
with (security_barrier = true) as
  select
    o.id            as order_id,
    p.client_code   as client_code,
    o.bags          as bags,
    o.service       as service,
    o.fragrance     as fragrance,
    o.status        as status,
    o.eta_ready_at  as eta_ready_at,
    o.created_at    as created_at,
    z.name          as zone_name
  from orders o
  join profiles p on p.id = o.customer_id
  left join addresses a on a.id = o.address_id
  left join zones z on z.id = a.zone_id
  where o.laundry_id = my_laundry_id();

create or replace view partner_order_specials
with (security_barrier = true) as
  select
    os.id             as id,
    os.order_id       as order_id,
    p.client_code     as client_code,
    os.item_name      as item_name,
    os.qty            as qty,
    os.comp_lav_cents as comp_lav_cents,  -- solo compenso; mai price_cli
    os.charged_at     as charged_at,
    os.created_at     as created_at
  from order_specials os
  join orders o   on o.id = os.order_id
  join profiles p on p.id = o.customer_id
  where o.laundry_id = my_laundry_id();

-- Espone le viste solo agli utenti autenticati (mai anon).
revoke all on partner_orders, partner_order_specials from anon;
grant select on partner_orders, partner_order_specials to authenticated;
