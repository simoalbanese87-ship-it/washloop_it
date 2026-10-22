-- «Abbonamento interrotto».
--
-- Perché
-- ------
-- Chi è stato cliente e ha smesso non aveva un posto dove stare. Restava
-- «convertito» — e allora si contava fra quelli portati dentro, che è falso —
-- oppure lo si spostava su «non interessato», che è peggio: quella persona ci
-- ha già provato e ci ha già pagato, ed è la prima lista da richiamare quando
-- c'è una novità da raccontare.
--
-- Lo stadio «Cliente perso» di Persone non basta e non è la stessa cosa: quello
-- lo calcola il programma dalla subscription e dice che cosa è successo ai
-- soldi; questo lo scrive chi telefona e dice a che punto è la riconquista.
--
-- Il vincolo va su entrambe le tabelle, come il 0079 e il 0089: in Persone lead
-- e clienti stanno nella stessa lista e lo stato si scrive ora sull'una ora
-- sull'altra. Se il vocabolario è lo stesso, lo deve dire il database in tutti
-- e due i posti.

alter table public.leads drop constraint if exists leads_contact_status_check;
alter table public.leads add constraint leads_contact_status_check
  check (contact_status in ('da_contattare','in_corso','in_attesa','fuori_zona','non_interessato','non_esiste','convertito','interrotto'));

alter table public.profiles drop constraint if exists profiles_contact_status_check;
alter table public.profiles add constraint profiles_contact_status_check
  check (contact_status is null or contact_status in ('da_contattare','in_corso','in_attesa','fuori_zona','non_interessato','non_esiste','convertito','interrotto'));

comment on column public.profiles.contact_status is
  'Stato di lavorazione del contatto, scritto a mano da chi telefona. «interrotto» = era un cliente e ha smesso: è una lista da richiamare, non un rifiuto, e non va confusa con lo stadio «Cliente perso», che invece si calcola dalla subscription.';
