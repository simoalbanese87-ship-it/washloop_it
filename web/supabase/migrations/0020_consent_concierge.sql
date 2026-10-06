-- 0020 — Consenso privacy (prova GDPR) + orario portineria sugli indirizzi.
alter table profiles  add column if not exists terms_accepted_at timestamptz;
alter table addresses add column if not exists concierge_hours text;
