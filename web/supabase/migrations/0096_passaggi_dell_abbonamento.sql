-- Quanti passaggi comprende un abbonamento.
-- =========================================
--
-- Perché
-- ------
-- Marta Savino ha comprato «due volte al mese», e il sistema non sa contarle.
-- Finché il servizio era «una volta a settimana per tutti», `puo_prenotare` —
-- un cancello aperto o chiuso — bastava: chi aveva l'abbonamento attivo
-- prenotava, e la cadenza la dava il calendario delle fasce. Da quando si
-- vendono accordi diversi, nessuno sa più dire quanti passaggi restano: né lei
-- né noi, e la risposta oggi si dà contando gli ordini a mano.
--
-- Il periodo è il ciclo pagato, non il mese
-- -----------------------------------------
-- `passaggi_per_ciclo` e non `_al_mese`: il diritto vale dentro il periodo che
-- il cliente ha pagato — quello che finisce a `current_period_end` — e non dal
-- primo all'ultimo del mese solare. È la data che Stripe rispetta ed è quella
-- che il cliente ha davanti; usare il mese solare vorrebbe dire che chi si
-- abbona il 28 ha due giorni per usare il mese.
--
-- `null` = nessun tetto: è il comportamento di oggi, e resta quello di tutti
-- gli abbonamenti già in corso. Non si inventa un limite a chi non l'ha
-- comprato.
--
-- Niente tabella di saldo
-- -----------------------
-- I passaggi usati **si contano dagli ordini**, che sono il fatto. Un contatore
-- scritto a parte diverge dal reale al primo ordine annullato a mano, e quando
-- i due numeri litigano nessuno sa quale credere.
--
-- Il credito che scorre
-- ---------------------
-- Quello che avanza scade col ciclo, salvo quello che l'ops decide di far
-- scorrere premendo «Porta avanti i non usati»: finisce in
-- `passaggi_riportati`, che si somma al diritto del ciclo nuovo. La data dice
-- quando è stato fatto, così due clic sullo stesso ciclo non raddoppiano il
-- regalo.

alter table public.subscriptions
  add column if not exists passaggi_per_ciclo int,
  add column if not exists passaggi_riportati int not null default 0,
  add column if not exists passaggi_riportati_at timestamptz;

alter table public.subscriptions
  drop constraint if exists subscriptions_passaggi_per_ciclo_positivi;

-- Zero passaggi non è un abbonamento che esiste: è un campo compilato male, e
-- lasciarlo passare bloccherebbe un cliente che paga. Stessa regola di
-- `bags_per_week` (migration 0074).
alter table public.subscriptions
  add constraint subscriptions_passaggi_per_ciclo_positivi
  check (passaggi_per_ciclo is null or passaggi_per_ciclo > 0);

alter table public.subscriptions
  drop constraint if exists subscriptions_passaggi_riportati_non_negativi;

alter table public.subscriptions
  add constraint subscriptions_passaggi_riportati_non_negativi
  check (passaggi_riportati >= 0);

comment on column public.subscriptions.passaggi_per_ciclo is
  'Quanti ritiri comprende l''abbonamento dentro il periodo pagato. null = nessun tetto (il comportamento storico: la cadenza la dà il calendario).';

comment on column public.subscriptions.passaggi_riportati is
  'Passaggi non usati che l''ops ha fatto scorrere nel ciclo in corso. Si sommano a passaggi_per_ciclo. Il resto scade con il ciclo.';
