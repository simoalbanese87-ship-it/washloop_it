-- Archiviare un contatto invece di buttarlo.
--
-- Perché
-- ------
-- Finora su un lead c'era un solo gesto: «Elimina», irreversibile, che cancella
-- la riga e con lei il CAP, la provenienza e quello che ci siamo detti al
-- telefono. Per un doppione va bene; per chi è interessato ma sta fuori zona no,
-- perché quella riga serve esattamente il giorno che la zona si apre.
--
-- Archiviato non è uno stato del contatto: una persona può essere insieme
-- «fuori zona» e archiviata, oppure archiviata e basta perché la richiesta è
-- vecchia. Per questo è una colonna sua e non un valore di contact_status.

alter table public.leads
  add column if not exists archiviato_at timestamptz;

comment on column public.leads.archiviato_at is
  'Quando è stato tolto dall''elenco di lavoro. La riga resta: si rivede col filtro «Archiviati» e si può riattivare. null = in lavorazione.';

create index if not exists leads_archiviato_idx on public.leads (archiviato_at) where archiviato_at is null;
