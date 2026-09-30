-- Abbonamento a termine: la prova a pagamento si spegne da sola
-- =============================================================
--
-- Vendere una prova a pagamento significa dare l'abbonamento vero — tutte le
-- funzionalita', per le settimane pagate — e poi chiuderlo. Finora si poteva
-- fare solo a mano: link mensile, e qualcuno che si ricorda di disdire il
-- giorno giusto. Su cento prove quel "qualcuno" non esiste, e la dimenticanza
-- si scopre da uno storno.
--
-- La durata vive nel prezzo Stripe (un solo ciclo lungo N settimane); queste
-- colonne sono la copia locale che serve a due cose che Stripe non sa fare:
-- distinguere una prova a termine da un abbonamento normale nel pannello, e
-- mandare l'avviso due giorni prima della fine.
--
-- Tutte nullable, nessuna colonna tolta: si applica prima del deploy senza
-- rompere niente. `null` su `termina_dopo_settimane` = abbonamento normale che
-- si rinnova, cioe' tutti quelli che esistono oggi.

alter table public.subscriptions
  add column if not exists termina_dopo_settimane int,
  add column if not exists fine_avviso_inviato_at timestamptz;

alter table public.subscriptions
  drop constraint if exists subscriptions_termina_dopo_settimane_valido;
alter table public.subscriptions
  add constraint subscriptions_termina_dopo_settimane_valido
  check (termina_dopo_settimane is null or termina_dopo_settimane between 1 and 52);

comment on column public.subscriptions.termina_dopo_settimane is
  'Prova a pagamento: durata in settimane del ciclo unico. null = abbonamento normale, si rinnova.';
comment on column public.subscriptions.fine_avviso_inviato_at is
  'Quando e'' partita la mail "finisce fra due giorni". Deduplica sull''invio, non sull''evento.';

-- La proposta deve poter dire "40,00 EUR per 1 settimana" invece di "/mese",
-- che oggi e' scritto a mano nella pagina e sarebbe falso su una prova.
alter table public.subscription_offers
  add column if not exists settimane int,
  add column if not exists sacchi int;

alter table public.subscription_offers
  drop constraint if exists subscription_offers_settimane_valide;
alter table public.subscription_offers
  add constraint subscription_offers_settimane_valide
  check (settimane is null or settimane between 1 and 52);

alter table public.subscription_offers
  drop constraint if exists subscription_offers_sacchi_positivi;
alter table public.subscription_offers
  add constraint subscription_offers_sacchi_positivi
  check (sacchi is null or sacchi > 0);
