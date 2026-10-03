-- Il cliente a consumo: prenota come gli altri, paga solo quello che lascia
-- ======================================================================
--
-- Un cliente che non vuole l'abbonamento ma vuole il servizio: ci da' i capi,
-- li quotiamo a listino, li addebitiamo sulla carta. Fin qui il sistema lo
-- sapeva gia' fare — l'addebito dei capi non ha mai avuto bisogno di un
-- abbonamento — ma gli mancavano due cose.
--
-- 1. `a_consumo`: il permesso di prenotare. Il controllo in prenotazione chiede
--    un abbonamento attivo, e senza questo flag l'unico modo di servirlo era
--    aprirgli il ritiro a mano ogni volta. Non e' un'informazione deducibile:
--    "non ha un abbonamento" vale anche per chi se n'e' andato, e a quello il
--    ritiro non lo si vuole lasciar prenotare.
--
-- 2. `stripe_customer_id`: dove tenerlo. Finora stava solo su `subscriptions`,
--    e un cliente a consumo una riga li' non ce l'ha. Il link di pagamento una
--    tantum creava il cliente su Stripe, incassava, salvava la carta — e
--    l'identificativo si perdeva. Al primo capo da addebitare `incassaExtraDel-
--    Ritiro` avrebbe risposto "non ha un profilo di pagamento su Stripe", cioe'
--    un incasso mancato su un cliente che la carta ce l'ha.

alter table public.profiles
  add column if not exists a_consumo boolean not null default false,
  add column if not exists stripe_customer_id text;

comment on column public.profiles.a_consumo is
  'Cliente senza abbonamento che puo'' prenotare lo stesso: paga i capi a listino, nessun canone, nessun capo compreso.';
comment on column public.profiles.stripe_customer_id is
  'Il cliente Stripe, per chi non ha una riga in subscriptions. Chi ce l''ha, quella resta la fonte.';

create index if not exists profiles_a_consumo_idx on public.profiles (a_consumo) where a_consumo;
