-- ============================================================
-- 0007 — Listino capi speciali (fuori listino base)
-- Fonte unica: contratto WashLoop · Allegato Listino Prezzi.
--   comp_lav_cents  = compenso lavanderia (col. D, IVA ESCLUSA)
--   price_cli_cents = prezzo cliente       (col. E, IVA INCLUSA)
-- I capi "compreso sacchetto" sono inclusi nel sacco standard → non elencati.
-- Privacy: la lavanderia vede SOLO il compenso (col. D), mai il prezzo
-- cliente. La restrizione a livello colonna è gestita in 0008 (view partner).
-- ============================================================

-- ---------- Tariffa sacco concordata (per lavanderia, non a listino) ----------
-- Compenso che WashLoop riconosce alla lavanderia per ogni sacco standard
-- lavorato. Concordato col partner, può variare per lavanderia.
alter table laundries add column if not exists bag_comp_cents int not null default 800;

-- ---------- Categorie listino ----------
create table if not exists special_categories (
  id    text primary key,          -- es. 'piumini'
  name  text not null,
  emoji text not null default '👕',
  sort  int  not null default 0
);

-- ---------- Articoli listino ----------
create table if not exists special_items (
  id              uuid primary key default gen_random_uuid(),
  category_id     text not null references special_categories on delete restrict,
  name            text unique not null,
  comp_lav_cents  int  not null,   -- col. D · compenso lavanderia (IVA escl)
  price_cli_cents int  not null,   -- col. E · prezzo cliente (IVA incl)
  active          boolean not null default true,
  sort            int  not null default 0
);
create index if not exists special_items_cat_idx on special_items (category_id, sort);

-- ---------- Capi speciali agganciati a un ordine (sacco separato) ----------
-- Inseriti dalla lavanderia al ricevimento → addebito automatico al cliente.
-- I prezzi sono "congelati" (snapshot) al momento dell'inserimento, così un
-- futuro aggiornamento listino non altera ordini già lavorati.
create table if not exists order_specials (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders on delete cascade,
  item_id               uuid references special_items on delete set null,
  item_name             text not null,         -- snapshot nome articolo
  qty                   int  not null default 1 check (qty > 0),
  comp_lav_cents        int  not null,          -- snapshot col. D
  price_cli_cents       int  not null,          -- snapshot col. E
  added_by              uuid references profiles, -- chi l'ha inserito (lavanderia)
  charged_at            timestamptz,            -- quando addebitato al cliente
  stripe_invoice_item   text,                   -- riferimento addebito Stripe
  created_at            timestamptz not null default now()
);
create index if not exists order_specials_order_idx on order_specials (order_id);

-- ---------- RLS ----------
alter table special_categories enable row level security;
alter table special_items      enable row level security;
alter table order_specials     enable row level security;

-- Catalogo: lettura a tutti gli autenticati, scrittura solo admin.
create policy "spec cat read"  on special_categories for select using (true);
create policy "spec cat admin" on special_categories for all using (is_admin()) with check (is_admin());
create policy "spec item read"  on special_items for select using (true);
create policy "spec item admin" on special_items for all using (is_admin()) with check (is_admin());

-- order_specials: visibili a chi vede l'ordine; scrittura staff (partner/admin).
create policy "ospec read" on order_specials for select using (can_see_order(order_id));
create policy "ospec staff write" on order_specials for all
  using (can_see_order(order_id) and auth_role() in ('partner','admin'))
  with check (can_see_order(order_id) and auth_role() in ('partner','admin'));

-- ============================================================
-- SEED LISTINO (valori esatti dal contratto · cents = €×100)
-- ============================================================
insert into special_categories (id, name, emoji, sort) values
  ('piumini',  'Piumini, coperte e biancheria', '🛏️', 1),
  ('pelle',    'Giacche e giacconi in pelle',   '🧥', 2),
  ('cappotti', 'Cappotti e capispalla',         '🧶', 3),
  ('scarpe',   'Scarpe e calzature',            '👟', 4),
  ('abiti',    'Abiti e capi vari',             '👔', 5)
on conflict (id) do update set name = excluded.name, emoji = excluded.emoji, sort = excluded.sort;

insert into special_items (category_id, name, comp_lav_cents, price_cli_cents, sort) values
  -- piumini
  ('piumini',  'Piumone',                  902, 1540,  1),
  ('piumini',  'Piumone d''oca',          1230, 2100,  2),
  ('piumini',  'Trapunta',                1230, 2100,  3),
  ('piumini',  'Sacco a pelo',             574,  980,  4),
  ('piumini',  'Sacco a pelo d''oca',      820, 1400,  5),
  ('piumini',  'Completo letto',           984, 1680,  6),
  ('piumini',  'Coperta in lana',          984, 1680,  7),
  ('piumini',  'Coperta merinos',         1639, 2800,  8),
  ('piumini',  'Copriletto piqué',         820, 1400,  9),
  ('piumini',  'Copriletto',               820, 1400, 10),
  ('piumini',  'Tappeto',                  287,  490, 11),
  -- pelle
  ('pelle',    'Giacca in pelle',         2049, 3250,  1),
  ('pelle',    'Giaccone in pelle',       2295, 3640,  2),
  ('pelle',    'Giubbotto in pelle',      1803, 2860,  3),
  ('pelle',    'Gilet in pelle',          1230, 2100,  4),
  ('pelle',    'Gonna in pelle',          1230, 2100,  5),
  ('pelle',    'Golf in pelle',            885, 1512,  6),
  ('pelle',    'Guanti in pelle',          656, 1120,  7),
  ('pelle',    'Soprabito in pelle',      2459, 3900,  8),
  ('pelle',    'Barbour',                 2459, 3900,  9),
  ('pelle',    'Montone',                 2869, 4550, 10),
  ('pelle',    'Soprabito montone',       2869, 4550, 11),
  ('pelle',    'Giubbino montone',        2459, 3900, 12),
  ('pelle',    'Pelliccia',               2705, 4290, 13),
  ('pelle',    'Giaccone pelliccia',      2705, 4290, 14),
  ('pelle',    'Woolrich',                 984, 1680, 15),
  ('pelle',    'Giacca interno pelle',    1230, 2100, 16),
  ('pelle',    'Giacca interno pelo sint.', 885, 1512, 17),
  ('pelle',    'Giacca inserti pelle',     885, 1512, 18),
  ('pelle',    'Eco montone',              984, 1680, 19),
  ('pelle',    'Eco pelliccia',            984, 1680, 20),
  -- cappotti
  ('cappotti', 'Cappotto',                 738, 1260,  1),
  ('cappotti', 'Cappotto in maglia',       443,  756,  2),
  ('cappotti', 'Giacca a vento',           656, 1120,  3),
  ('cappotti', 'Impermeabile',             738, 1260,  4),
  ('cappotti', 'Eco giubbino',             738, 1260,  5),
  ('cappotti', 'Gilet piuma',              492,  840,  6),
  -- scarpe
  ('scarpe',   'Scarpe in pelle',         1639, 2800,  1),
  ('scarpe',   'Scarpe tessuto + pelle',  1230, 2100,  2),
  ('scarpe',   'UGG',                      1475, 2520,  3),
  ('scarpe',   'UGG baby',                 1230, 2100,  4),
  -- abiti
  ('abiti',    'Giacca',                   369,  630,  1),
  ('abiti',    'Gilet',                    221,  378,  2),
  ('abiti',    'Cappello',                 148,  252,  3)
on conflict (name) do update set
  category_id     = excluded.category_id,
  comp_lav_cents  = excluded.comp_lav_cents,
  price_cli_cents = excluded.price_cli_cents,
  sort            = excluded.sort,
  active          = true;
