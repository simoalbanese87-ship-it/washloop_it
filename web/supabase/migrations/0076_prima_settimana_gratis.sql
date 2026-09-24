-- La prima settimana gratuita: carta a garanzia, addebito dopo la riconsegna.
--
-- Perché
-- ------
-- Chi arriva paga 160 € prima di aver visto tornare un sacco. Una prova
-- gratuita con la carta a garanzia toglie quel cancello: si paga il giorno dopo
-- che il bucato è tornato, cioè quando si sa se il servizio funziona.
--
-- La regola che regge tutto
-- ------------------------
-- **La prova nasce già con una data di fine vera su Stripe.** Non si crea mai
-- una prova aperta da riempire dopo. Così il caso peggiore di qualunque guasto
-- — Stripe che risponde 500, il nostro codice che non gira, un ordine che non
-- nasce — è «il cliente ha avuto gratis la finestra di prenotazione»: una
-- perdita nota e limitata. Lo spostamento della data al giorno dopo la
-- riconsegna è un miglioramento dell'esperienza, NON il meccanismo che fa
-- incassare. Chi un domani togliesse la data alla creazione per calcolarla
-- dall'ordine farebbe sparire il paracadute senza accorgersene.
--
-- I due numeri
-- ------------
--   prova_giorni  (sul piano)  il paracadute: quanto tempo si ha per prenotare
--                              il primo ritiro. Scade lì se non si prenota.
--   prova_tetto_at (sull'abbonamento)  il muro, congelato alla creazione e mai
--                              ricalcolato. È l'unica cosa che impedisce a una
--                              catena di prenota-e-disdici di allungare la
--                              prova all'infinito.
--
-- Sta sul piano e non in una costante nel codice perché accendere e spegnere
-- l'offerta deve essere una riga di SQL, non un deploy.

alter table public.plans
  add column if not exists prova_giorni int not null default 0;

alter table public.plans
  drop constraint if exists plans_prova_giorni_sensata;

alter table public.plans
  add constraint plans_prova_giorni_sensata
  check (prova_giorni >= 0 and prova_giorni <= 30);

comment on column public.plans.prova_giorni is
  'Giorni di prova gratuita al checkout: il paracadute entro cui prenotare il primo ritiro. 0 = nessuna prova, ed è il default per i piani nuovi. Si accende e si spegne da qui, senza deploy.';

update public.plans set prova_giorni = 10 where active;

alter table public.subscriptions
  add column if not exists prova_fine_at timestamptz,
  add column if not exists prova_tetto_at timestamptz,
  add column if not exists prova_ordine_id uuid references public.orders on delete set null,
  add column if not exists prova_avviso_inviato_at timestamptz;

comment on column public.subscriptions.prova_fine_at is
  'Quando scatta il primo addebito: la copia locale di `trial_end` di Stripe, riallineata a ogni webhook. Serve a mostrarla senza interrogare Stripe, e a sapere se è già stata spostata.';

comment on column public.subscriptions.prova_tetto_at is
  'Il muro, congelato al checkout e mai ricalcolato: è l''unica cosa che impedisce a una catena di prenota-e-disdici di allungare la prova all''infinito. Viaggia nei metadata della subscription perché al checkout questa riga non esiste ancora.';

comment on column public.subscriptions.prova_ordine_id is
  'Il ritiro a cui la prova è agganciata. Uno solo: chi ne prenota due nella stessa settimana ha prenotato due sacchi, non due settimane. `on delete set null` e non cascade — cancellare un ordine non deve poter cancellare un abbonamento.';

comment on column public.subscriptions.prova_avviso_inviato_at is
  'Quando è partito l''avviso «la prova sta per finire». Deduplica su questa colonna e non sull''evento: spostando `trial_end`, Stripe riemette `trial_will_end` con un id nuovo e `eventoGiaVisto` non lo ferma.';

-- Una prova per persona. Senza, chi disdice durante la prova e si riscrive ha
-- un'altra settimana gratis, all'infinito: è l'unico modo di entrare gratis per
-- sempre che questo disegno lascerebbe aperto.
alter table public.profiles
  add column if not exists prova_usata_at timestamptz;

comment on column public.profiles.prova_usata_at is
  'Quando questa persona ha usato la sua prova gratuita. Il checkout non ne concede una seconda: senza, disdire e riscriversi darebbe un''altra settimana gratis ogni volta.';
