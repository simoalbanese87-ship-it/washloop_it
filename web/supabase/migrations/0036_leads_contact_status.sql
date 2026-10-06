-- 0036_leads_contact_status.sql
-- Stato di lavorazione del contatto sui lead della landing /disponibilita.
-- Serve al team commerciale per sapere a che punto è ogni richiesta: finora la
-- dashboard mostrava solo "Richiesta disponibilità", uguale per tutti.

alter table leads add column if not exists contact_status text not null default 'da_contattare';

-- Il check sta qui e non solo nel codice: i valori arrivano da un <select>, ma
-- un valore fuori lista rovinerebbe i filtri senza che nessuno se ne accorga.
alter table leads drop constraint if exists leads_contact_status_check;
alter table leads add constraint leads_contact_status_check
  check (contact_status in ('da_contattare','non_esiste','non_interessato','in_corso','convertito'));

create index if not exists leads_contact_status_idx on leads (contact_status);
