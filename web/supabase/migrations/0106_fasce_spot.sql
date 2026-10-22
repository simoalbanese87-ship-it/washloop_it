-- Le fasce aperte una tantum si riconoscono, e dicono fin quando valgono.
--
-- Perché
-- ------
-- Il calendario generale è una cosa sola e vale per tutti: ritiri il martedì
-- (lavanderia) e il mercoledì (stiro), riconsegne il venerdì pomeriggio. Ma
-- capita di aprire una fascia in più per una persona — un cliente che quella
-- settimana non può, un volume grosso, una richiesta al telefono.
--
-- Il problema è che una fascia non si può assegnare a nessuno: è di tutti
-- quelli del suo servizio. Quindi una fascia aperta «per Tizio» entra nell'app
-- di tutti, e se nessuno se la ricorda resta lì per mesi. È esattamente come
-- il lunedì è diventato un giorno di ritiro senza che nessuno lo decidesse.
--
-- Due colonne, e la differenza fra una regola e un'eccezione smette di vivere
-- nella memoria di chi l'ha aperta:
--   `spot`      — questa fascia non fa parte del calendario generale;
--   `nota`      — perché è stata aperta, in parole (è la cosa che si dimentica);
--   `vale_fino_al` — l'ultimo giorno in cui ha senso. Oltre quel giorno la
--                 fascia va riequilibrata: il pannello la segnala, non la
--                 cancella da sé, perché una fascia con un ordine sopra non si
--                 tocca senza guardare.

alter table public.slots
  add column if not exists spot boolean not null default false,
  add column if not exists nota text,
  add column if not exists vale_fino_al date;

comment on column public.slots.spot is
  'true = fascia aperta fuori dal calendario generale, per un caso singolo. Non è assegnabile a un cliente — nessuna fascia lo è — quindi la vedono tutti quelli del suo servizio: per questo ha una scadenza e una nota.';
comment on column public.slots.vale_fino_al is
  'Ultimo giorno in cui la fascia spot ha senso. Oltre, il pannello la segnala da riequilibrare. null su una spot = «per sempre», cioè è entrata nel calendario generale e andrebbe tolta la spunta.';

-- Le fasce di oggi sono il calendario generale, deciso il 2 e il 12 ottobre
-- 2026: nessuna è spot, e il default a false le lascia dove stanno.
create index if not exists slots_spot_idx on public.slots (spot, vale_fino_al) where spot;
