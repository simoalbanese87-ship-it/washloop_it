-- Quando un'automazione gira, resta scritto. Anche quando non ha fatto niente.
--
-- Perché
-- ------
-- Oggi si registrano solo i guasti. Un cron che non parte affatto non lascia
-- traccia da nessuna parte, quindi è **indistinguibile** da uno che è partito e
-- non aveva niente da dire: entrambi producono silenzio.
--
-- Non è un'ipotesi. Il 20 settembre il riepilogo del mattino è morto e non è
-- arrivata nessuna email; ce ne siamo accorti quattro giorni dopo, guardando
-- un'altra cosa. E prima ancora, i due cron che «non hanno MAI funzionato» sono
-- rimasti muti per settimane senza che niente li reclamasse.
--
-- Questa tabella rende visibile il silenzio: se l'ultimo giro di un lavoro è di
-- due giorni fa, quella riga vecchia lo dice. Un registro che scrive solo
-- quando le cose vanno male non può dirti che non stanno andando affatto.

create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  -- Il nome del lavoro, uguale al percorso: "recurring", "daily-digest"…
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  -- Cosa ha fatto, in una riga leggibile: «4 ordini creati», «nessuna novità».
  -- «Non ha fatto niente» è un esito, e va scritto come gli altri.
  riassunto text,
  errore text
);

comment on table public.cron_runs is
  'Una riga per ogni esecuzione di un cron, riuscita o no. Serve a distinguere «è girato e non aveva niente da dire» da «non è girato»: senza, le due cose producono lo stesso silenzio.';

create index if not exists cron_runs_job_started_idx
  on public.cron_runs (job, started_at desc);

alter table public.cron_runs enable row level security;

drop policy if exists "cron_runs: solo admin legge" on public.cron_runs;
create policy "cron_runs: solo admin legge" on public.cron_runs
  for select to authenticated using (is_admin());

-- Scrive il service client dei cron, che salta la RLS: nessuna policy di
-- inserimento, così nessun altro può sporcare il registro.
