-- I compiti del rider: dare il materiale, e riprenderselo.
-- ========================================================
--
-- Perché
-- ------
-- Quando un cliente diventa attivo c'è un giro di cose da fare che oggi non
-- sta scritto da nessuna parte: portargli i cartellini QR e il sacco. E quando
-- se ne va, lo stesso al contrario: quel materiale è nostro e va ripreso.
-- Finora le due liste vivevano nella testa di chi gestisce il servizio. Con otto
-- abbonati funziona; la prima volta che non funziona nessuno se ne accorge,
-- perché un compito dimenticato non dà errore — manca e basta.
--
-- Due tipi, non un motore di attività
-- -----------------------------------
--   * `dotazione` — portare il materiale a chi comincia;
--   * `rientro`   — riprenderlo da chi ha chiuso.
--
-- Sono due, e sono in un `check`. Non è un gestore di to-do generico: il
-- momento in cui diventa possibile scrivere «ricordati di chiamare Mario» qui
-- dentro, questa tabella smette di essere affidabile per le due cose che deve
-- fare, perché nessuno si fida più di una lista piena di appunti.
--
-- Il compito è il promemoria, non il registro
-- -------------------------------------------
-- Quello che il cliente ha materialmente in mano sta sul suo profilo
-- (`tags_delivered_at` dalla 0043, e da qui `borsa_consegnata_at`): è la stessa
-- scelta già fatta per i passaggi, che si contano dagli ordini perché gli
-- ordini sono il fatto. Due contatori che raccontano la stessa cosa divergono
-- al primo errore, e poi non si sa più quale credere.
--
-- `visibile_dal`
-- --------------
-- Serve al caso più comune delle disdette: il cliente disdice il 3, ma ha
-- pagato fino al 28 e fino al 28 il servizio gli spetta. Il rientro nasce
-- subito — così non dipende da nessuno che se ne ricordi dopo — ma al rider
-- non deve comparire prima del 28, altrimenti si presenta a riprendersi il
-- sacco di una persona che lo sta ancora usando.
--
-- Il doppione impossibile
-- -----------------------
-- L'indice unico parziale su (cliente, tipo) fra i compiti aperti. Stripe
-- rimanda lo stesso evento per tre giorni, il cron ripassa ogni notte, e la
-- pagina di ritorno dal checkout richiama la stessa sincronizzazione: senza
-- l'indice, lo stesso cliente comparirebbe tre volte nel giro del rider. Si
-- fa nel database e non nel codice chiamante per il motivo della 0071: una
-- garanzia che vive nei chiamanti la dimentica il prossimo chiamante.

create table if not exists public.compiti (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  tipo        text not null check (tipo in ('dotazione', 'rientro')),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  -- Chi lo deve fare. Null = ancora da assegnare: lo si vede comunque in
  -- `/admin/compiti`, perché un compito senza rider è il caso che va risolto,
  -- non quello che va nascosto.
  assegnato_a uuid references public.profiles(id) on delete set null,
  stato       text not null default 'aperto' check (stato in ('aperto', 'fatto', 'annullato')),
  -- Da quando il rider lo vede nel suo giro.
  visibile_dal date not null default current_date,
  -- Entro quando. Indicativo: nessun automatismo ci si appoggia, serve
  -- all'ordinamento e a far capire cosa è in ritardo.
  scade_il    date,
  nota        text,
  origine     text not null default 'automatico' check (origine in ('automatico', 'pannello', 'cron')),
  fatto_at    timestamptz,
  fatto_da    uuid references public.profiles(id) on delete set null,
  annullato_at     timestamptz,
  annullato_perche text
);

comment on table public.compiti is
  'Promemoria operativi di dotazione e rientro del materiale. Quello che il cliente ha in mano sta sul suo profilo, non qui.';
comment on column public.compiti.visibile_dal is
  'Da quando compare nel giro del rider. Un rientro programmato nasce subito ma si vede dalla fine del servizio pagato.';
comment on column public.compiti.origine is
  'automatico = nato da un cambio di abbonamento; cron = recuperato dal passaggio notturno; pannello = creato a mano.';

-- Un compito aperto per tipo e per cliente, e non uno di più.
create unique index if not exists compiti_uno_aperto_per_tipo
  on public.compiti (customer_id, tipo)
  where stato = 'aperto';

-- Il giro del rider: i suoi compiti aperti e già visibili.
create index if not exists compiti_del_rider_idx
  on public.compiti (assegnato_a, visibile_dal)
  where stato = 'aperto';

alter table public.compiti enable row level security;

create policy "compiti admin" on public.compiti
  for all using (is_admin()) with check (is_admin());

-- Il rider legge i suoi. Le scritture passano dall'azione lato server, che
-- verifica l'assegnazione e aggiorna anche il profilo del cliente: lasciare
-- che il browser cambi `stato` da solo vorrebbe dire due strade per lo stesso
-- fatto, e una sola che tiene aggiornato il resto.
create policy "compiti rider legge i suoi" on public.compiti
  for select using (assegnato_a = auth.uid());

-- Il sacco personale, accanto ai cartellini della 0043.
--
-- È un sacco **suo**: glielo portiamo una volta, resta a lui per tutta la
-- durata dell'abbonamento e torna a noi quando chiude. Per questo la data è
-- una e non un contatore di passaggi: non è il sacco che gira fra noi e la
-- lavanderia, è la sua dotazione.
alter table public.profiles
  add column if not exists borsa_consegnata_at timestamptz,
  add column if not exists borsa_qty int,
  add column if not exists materiale_rientrato_at timestamptz;

comment on column public.profiles.borsa_consegnata_at is
  'Quando il cliente ha ricevuto il suo sacco personale. Null = non ancora consegnato.';
comment on column public.profiles.borsa_qty is
  'Quanti sacchi gli abbiamo lasciato.';
comment on column public.profiles.materiale_rientrato_at is
  'Quando abbiamo ripreso sacco e cartellini alla chiusura. Null = sono ancora da lui.';
