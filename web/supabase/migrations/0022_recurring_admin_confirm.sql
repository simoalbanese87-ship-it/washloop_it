-- 0022 — L'admin può modificare gli orari di ritiro ricorrente del cliente.
-- Ogni modifica lato admin marca la ricorrenza come "da confermare": il cliente
-- vede un banner in app e conferma la presa visione. La modifica è comunque già
-- attiva (il cron usa i nuovi orari); la conferma è solo un acknowledgment.

alter table recurring_pickups add column if not exists needs_confirmation boolean not null default false;
alter table recurring_pickups add column if not exists updated_by_admin_at timestamptz;
