-- 0015 — Ritiri ricorrenti (scelta dell'utente: singolo o ogni settimana).
-- Il cliente in fase di prenotazione può attivare la ripetizione settimanale.
-- Un cron (/api/cron/recurring) genera in automatico l'ordine della settimana
-- successiva agganciandolo a uno slot reale con stesso giorno+ora (Europe/Rome).

create table if not exists recurring_pickups (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles  on delete cascade,
  address_id  uuid not null references addresses on delete cascade,
  weekday     int  not null check (weekday between 0 and 6),  -- 0=dom … 6=sab (ora di Roma)
  hhmm        text not null,                                   -- "09:00" ora di Roma
  bags        int  not null default 1,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Traccia l'origine ricorrente dell'ordine (per dedup e per mostrarlo in app).
alter table orders add column if not exists recurring_id uuid references recurring_pickups on delete set null;

alter table recurring_pickups enable row level security;

-- Il cliente gestisce solo le proprie ricorrenze; admin tutto; cron usa service-role.
create policy "recpick owner" on recurring_pickups for all
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "recpick admin" on recurring_pickups for all
  using (is_admin()) with check (is_admin());
