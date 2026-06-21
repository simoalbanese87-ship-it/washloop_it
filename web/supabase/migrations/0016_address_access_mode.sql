-- 0016 — Modalità di ritiro per indirizzo (come il driver gestisce il sacco).
--   door     = lascio il sacco fuori dalla porta
--   home     = sono in casa
--   concierge= consegna/ritiro in portineria
-- access_note: dettaglio libero (es. nome del portinaio, istruzioni accesso).

alter table addresses add column if not exists access_mode text not null default 'door';
alter table addresses add column if not exists access_note text;
