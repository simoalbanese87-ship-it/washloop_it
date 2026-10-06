-- 0087 — Le camicie comprese le può leggere anche il cliente.
--
-- La 0040 ha tolto ad `anon` e `authenticated` il SELECT su tutta
-- `special_items` e l'ha ridato colonna per colonna, perché sulla stessa riga
-- c'è `comp_lav_cents`, cioè il margine. Scelta giusta, che però ha portato via
-- anche `incluse_per_sacco`: l'app cliente che prova a leggerla non riceve un
-- errore ma un `null` — PostgREST nega, il codice vede dati vuoti — e la frase
-- «Fino a 3 camicie stirate per sacco» sparisce senza che nessuno se ne accorga.
--
-- Quel numero non è un dato interno: è la promessa che facciamo in home, nelle
-- FAQ, nel listino pubblico e sul sacco. Negarlo a chi l'ha comprata non
-- protegge niente.
grant select (incluse_per_sacco) on public.special_items to anon, authenticated;

-- La vista di comodo lo porta con sé, così l'app cliente non deve interrogare
-- la tabella con le colonne negate per sapere cosa le spetta.
create or replace view public.special_items_public
with (security_invoker = on) as
  select id, category_id, name, price_cli_cents, sort, incluse_per_sacco
  from public.special_items
  where active;

comment on view public.special_items_public is
  'Listino capi speciali per il cliente: il prezzo che paga lui e quante unità sono comprese in ogni sacco. Il compenso lavanderia non passa di qui.';

grant select on public.special_items_public to anon, authenticated;
