-- 0004 — Dettaglio ordine: note interne staff
alter table orders add column if not exists staff_notes text;
