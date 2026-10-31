-- Un token di disiscrizione anche per i clienti.
-- =============================================
--
-- Perché serve
-- ------------
-- Finora il token esisteva solo su `leads`: la landing manda email commerciali
-- ai contatti, e il link «Disiscriviti» in fondo identifica la riga del lead.
-- Ai clienti invece abbiamo mandato solo email di **servizio** — ritiro
-- prenotato, bucato pronto, ricevuta — e da quelle non ci si disiscrive: chi
-- paga un abbonamento deve sapere quando passiamo.
--
-- La prima email di marketing a un cliente (l'invito a recensire chi era già
-- cliente prima che l'invito automatico esistesse) cambia le cose: una
-- comunicazione commerciale senza via d'uscita non si manda, né per legge né
-- per educazione.
--
-- Perché un token e non l'email nell'URL
-- --------------------------------------
-- Lo stesso motivo dei lead: un link inoltrato, finito in un log del server o
-- nella cronologia di un browser condiviso non deve rivelare chi è la persona.
-- Il token è un UUID che non dice niente di suo.
--
-- Dove finisce la volontà
-- -----------------------
-- La riga in `email_optouts` (chiave: l'email), che è la lista che l'invio
-- consulta sempre e che sopravvive alla cancellazione del profilo. Qui non si
-- aggiunge nessuna colonna di stato sul profilo: due posti che dicono la
-- stessa cosa sono due posti che un giorno diranno cose diverse.

alter table public.profiles
  add column if not exists unsub_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_unsub_token_key
  on public.profiles (unsub_token);

comment on column public.profiles.unsub_token is
  'Token del link «Disiscriviti» nelle email di marketing al cliente. Identifica la persona senza mettere la sua email nell''URL. La disiscrizione scrive in public.email_optouts, che è la lista che l''invio consulta.';
