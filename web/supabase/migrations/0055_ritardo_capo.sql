-- Un capo che richiede più tempo, e la riconsegna che si sistema di conseguenza.
--
-- Perché serve
-- ------------
-- `eta_ready_at` viene calcolato una volta sola alla prenotazione (ritiro +
-- ore di lavorazione del piano) e da lì non lo tocca più nessuno, tranne
-- l'admin a mano. La lavanderia — cioè l'unica che sa se una macchia esce in
-- due ore o in due giorni — non aveva nessuna leva: poteva solo sforare in
-- silenzio, e il cliente lo scopriva quando il rider non arrivava.
--
-- Cosa si registra
-- ----------------
-- `pronto_stimato` è la data che dichiara la lavanderia: «questo capo sarà
-- pronto per allora». Il resto lo calcola il sistema — se la riconsegna già
-- prenotata regge non si tocca niente, altrimenti si sposta.
--
-- `riconsegna_da` e `riconsegna_a` tengono la traccia dello spostamento. Stanno
-- sulla SEGNALAZIONE e non sull'ordine di proposito: così la storia intera —
-- «c'era una macchia d'unto, per quello è slittato, dal 4 al 9» — si legge in
-- una riga sola anche fra sei mesi, invece di dover incrociare l'ordine con i
-- suoi eventi e indovinare il nesso.

alter table public.order_issues
  add column pronto_stimato timestamptz,
  add column riconsegna_da  uuid references public.slots(id) on delete set null,
  add column riconsegna_a   uuid references public.slots(id) on delete set null;

comment on column public.order_issues.pronto_stimato is
  'Quando la lavanderia dichiara che quel capo sarà pronto. Nullo = nessun ritardo dichiarato.';
comment on column public.order_issues.riconsegna_da is
  'Fascia di riconsegna promessa prima dello spostamento. Nulla se non è stato spostato niente.';
comment on column public.order_issues.riconsegna_a is
  'Fascia di riconsegna nuova. Nulla se la riconsegna prenotata reggeva.';
