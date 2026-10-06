-- 0048 — Un posto dove finiscono i guasti, invece di `console.error`.
--
-- Nessuno guarda i log di Vercel. Le conseguenze si sono viste: per un mese
-- intero non è arrivato un solo evento di pagamento da Stripe e non se n'è
-- accorto nessuno, perché non c'era niente che guardasse. Stessa sorte per le
-- email che non partono (`sendMail` restituisce un errore che nessuno legge) e
-- per i cron che falliscono di notte.
--
-- Qui le righe si scrivono e basta: a leggerle è il riepilogo che arriva già
-- ogni mattina agli admin. Niente servizi esterni, niente account nuovi.

create table if not exists incidenti (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Da quale parte del sistema arriva: 'email', 'cron', 'webhook', 'push'.
  -- Testo libero e non enum: aggiungere un'area non deve richiedere una migration
  -- proprio nel momento in cui si sta correndo dietro a un guasto.
  area text not null,
  messaggio text not null,
  dettaglio jsonb
);

comment on table incidenti is
  'Guasti applicativi: email non partite, cron falliti, webhook rifiutati. Letti dal riepilogo giornaliero agli admin.';

-- L'unica lettura che si fa è "le ultime 24 ore", sempre.
create index if not exists incidenti_recenti_idx on incidenti (created_at desc);

alter table incidenti enable row level security;

-- Scrittura solo con service role (che salta la RLS): un guasto lo registra il
-- server, mai il browser. Lettura ai soli admin, così la tabella si può
-- guardare anche dal pannello senza esporre niente.
drop policy if exists "incidenti admin read" on incidenti;
create policy "incidenti admin read" on incidenti for select using (is_admin());
