-- La camicia entra a listino.
--
-- Serviva e non c'era: l'app promette da sempre «nel sacco ci stanno fino a 3
-- camicie, dalla quarta in poi si contano a listino», ma in listino la camicia
-- non è mai esistita — né qui, né nella 0007 che ha caricato il listino
-- originale della lavanderia. Chi ne metteva quattro non era addebitabile.
--
-- Prezzo concordato con Simone il 31/08/2026: 3,50 € al cliente. Il compenso
-- lavanderia segue il rapporto costante di tutto il listino (58,6% del prezzo
-- cliente, come Piumone 902/1540, Giacca 369/630, Cappello 148/252):
-- 350 × 0,586 = 205 centesimi.
--
-- Va nella categoria 'abiti', accanto a Giacca, Gilet e Cappello: è il posto
-- dove un capo da armadio si cerca.
--
-- `on conflict (name)` come nella 0007: rilanciare la migrazione non duplica
-- e riallinea il prezzo se un giorno cambia.

insert into public.special_items (category_id, name, comp_lav_cents, price_cli_cents, sort, active)
values ('abiti', 'Camicia', 205, 350, 0, true)
on conflict (name) do update set
  category_id     = excluded.category_id,
  comp_lav_cents  = excluded.comp_lav_cents,
  price_cli_cents = excluded.price_cli_cents,
  sort            = excluded.sort,
  active          = excluded.active;
