-- 0042 — Disiscrizione per le email che non sono di servizio.
--
-- I due flussi vanno tenuti separati, e la differenza non è di stile ma di
-- legge. Le email legate a un ordine o all'account (ritiro prenotato, bucato
-- pronto, riconsegna programmata, ricevuta, reset password, benvenuto) sono
-- comunicazioni di servizio: non si possono disiscrivere, altrimenti il cliente
-- resterebbe senza sapere quando passiamo. Tutto il resto — conferma al lead
-- della landing, e domani eventuali comunicazioni commerciali — richiede il
-- link di disiscrizione e gli header List-Unsubscribe.
--
-- Qui c'è solo la parte dati: token per il link e lista dei disiscritti.

-- Token per riconoscere chi clicca senza mettere l'email nell'URL. Casuale e
-- non derivato da un segreto: così i link restano validi anche quando ruotiamo
-- le chiavi, cosa che è già in programma.
alter table leads
  add column if not exists unsub_token uuid not null default gen_random_uuid(),
  add column if not exists unsubscribed_at timestamptz;

create unique index if not exists leads_unsub_token_idx on leads (unsub_token);

comment on column leads.unsub_token is
  'Token del link di disiscrizione. Non è un segreto condiviso: identifica solo questa riga.';

-- Lista globale dei disiscritti: la consulta l''invio prima di ogni email
-- non di servizio, qualunque sia la fonte. Sta separata da `leads` perché un
-- domani potrà valere anche per i clienti, e perché la disiscrizione deve
-- sopravvivere alla cancellazione del lead.
create table if not exists email_optouts (
  email       text primary key,
  created_at  timestamptz not null default now(),
  source      text
);

comment on table email_optouts is
  'Chi non vuole più email non di servizio. Confrontare sempre in minuscolo.';

alter table email_optouts enable row level security;

-- Nessuna policy per anon/authenticated: si scrive e si legge solo dal server
-- (service role), che le RLS non le attraversa. La disiscrizione passa da una
-- route dedicata, non dalle API pubbliche: senza questo, chiunque potrebbe
-- disiscrivere l''indirizzo di chiunque altro.
create policy "optout admin" on email_optouts
  for all using (is_admin()) with check (is_admin());
