-- ============================================================
-- 0009 — Listino sicuro per il portale lavanderia
-- Il partner sceglie i capi speciali da addebitare, ma NON deve vedere
-- il prezzo cliente (price_cli_cents, col. E). La base `special_items` ha
-- read `using(true)` → esporrebbe la col. E a chiunque sia autenticato.
-- Soluzione: una vista che proietta solo il compenso lavanderia (col. D).
-- Lo snapshot del price_cli all'inserimento avviene lato server (service
-- role), così la col. E non transita mai dal browser del partner.
-- ============================================================

create or replace view partner_special_items
with (security_barrier = true) as
  select
    si.id              as id,
    si.category_id     as category_id,
    sc.name            as category_name,
    sc.emoji           as category_emoji,
    sc.sort            as category_sort,
    si.name            as name,
    si.comp_lav_cents  as comp_lav_cents,   -- solo col. D; mai price_cli
    si.sort            as sort
  from special_items si
  join special_categories sc on sc.id = si.category_id
  where si.active;

revoke all on partner_special_items from anon;
grant select on partner_special_items to authenticated;
