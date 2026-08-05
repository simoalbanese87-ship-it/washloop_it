-- 0033_leads.sql
-- Lead della landing "Verifica disponibilità" (/disponibilita): richieste di
-- contatto raccolte fuori dal flusso di vendita (niente prezzi, niente checkout).
-- Fonte di verità: qui. La copia sul Google Sheet è un mirror best-effort, e il
-- foglio è SEPARATO da quello del funnel così `waitlistLeads()` non lo rilegge
-- creando doppioni in dashboard.

create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  full_name   text not null,
  email       text not null,
  cap         text,
  plan        text,                              -- 'S' | 'M' | 'L' (piano preferito, non un acquisto)
  zone_id     uuid references zones on delete set null,
  covered     boolean not null default false,    -- CAP mappato in zone_caps al momento dell'invio
  source      text not null default 'landing',   -- pagina di provenienza
  utm         jsonb,                             -- utm_source / utm_medium / utm_campaign
  consent_at  timestamptz not null default now(),-- consenso privacy (GDPR): quando è stato dato
  -- Antispam: mai l'IP in chiaro (minimizzazione GDPR), solo un hash con segreto
  -- server-side. Serve al rate limit "max N richieste/ora dallo stesso IP".
  ip_hash     text,
  notes       text
);

create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists leads_ip_recent_idx on leads (ip_hash, created_at desc);
-- Un secondo invio dalla stessa email aggiorna la riga invece di duplicarla.
-- Indice sulla colonna (non su lower(email)): l'upsert di PostgREST richiede un
-- vincolo unico sulla colonna esatta. L'email viene normalizzata a minuscolo
-- nella Server Action prima di arrivare qui.
create unique index if not exists leads_email_uniq on leads (email);

alter table leads enable row level security;

-- Nessuna policy di INSERT: la landing è pubblica e scrive solo via service role
-- (Server Action `submitLead`), così un anon non può inserire né leggere nulla.
-- Lettura per l'admin autenticato; la dashboard sales legge via service client
-- dietro il guard di ruolo della pagina.
create policy "leads admin read" on leads for select using (is_admin());
create policy "leads admin write" on leads for all using (is_admin()) with check (is_admin());
