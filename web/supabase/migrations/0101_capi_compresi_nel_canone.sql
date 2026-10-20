-- I capi che il canone comprende, e chi li paga.
-- =============================================
--
-- Perché
-- ------
-- Il piano su misura di Savino comprende «4 maglioni e 1 cappotto». Quella
-- frase vive in una chat: il programma non la conosce, quindi alla consegna di
-- 6 maglie, 1 cappotto e 1 giacca il pannello propone di addebitare tutto —
-- 48,30 € invece dei 16,10 € dovuti. La sottrazione la farebbe una persona a
-- mente, e guardando l'addebito dopo non si potrebbe più dire se era giusto.
-- È la stessa ragione per cui esiste la franchigia delle camicie (0059).
--
-- Due comprensioni diverse, e la differenza decide chi paga
-- ---------------------------------------------------------
-- Ne esisteva una sola: `special_items.incluse_per_sacco`, globale sul listino,
-- tre camicie per sacco. Quelle camicie stanno **dentro** il compenso del
-- sacco che versiamo comunque alla lavanderia, quindi non le paga nessuno dei
-- due — ed è giusto.
--
-- Un capo compreso in un canone su misura è un'altra cosa: il cliente non lo
-- paga perché gliel'abbiamo venduto dentro il canone, ma la lavanderia quel
-- capo l'ha lavorato e va pagata. È esattamente la regola del capo regalato
-- della 0068, dove il compenso resta dovuto perché «il lavoro c'è stato».
--
-- Per questo le due comprensioni restano separate fin qui, nelle colonne: è la
-- distinzione stessa a dire se si paga, e mescolarle in un contatore solo
-- vorrebbe dire perderla.
--
-- Per ciclo pagato, come i passaggi
-- ---------------------------------
-- I quattro maglioni valgono per il mese pagato, non per ritiro e non per
-- sacco: si consumano su uno o più ritiri e si azzerano al rinnovo. È la scelta
-- della 0096 per i passaggi, e per la stessa ragione **non c'è nessun contatore
-- di saldo**: quello che è stato consumato si conta dalle righe degli ordini,
-- che sono il fatto. Un contatore scritto a parte diverge dal reale al primo
-- capo annullato a mano.
--
-- Quello che avanza non si riporta: scade col ciclo. Un credito che si accumula
-- per sempre, dopo tre mesi di pausa, diventa un cappotto da regalare — e se
-- davvero lo si vuole regalare, lo si fa con lo storno «regalato», dove si vede
-- e si spiega.
--
-- Perché anche la categoria, e non solo il capo
-- ---------------------------------------------
-- L'accordo dice «1 cappotto» e Savino ha portato un **Impermeabile**. Con il
-- solo riferimento alla voce di listino, chi configura dovrebbe scrivere
-- «Impermeabile» — una bugia sull'accordo — e il mese in cui arriva un cappotto
-- vero la franchigia non scatterebbe, senza dirlo a nessuno. Con la categoria
-- la riga diventa «un capo fra i cappotti e capispalla», che è quello che è
-- stato promesso davvero.

create table if not exists public.capi_compresi (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  -- O un capo preciso, o una categoria: mai tutti e due, mai nessuno.
  item_id         uuid references public.special_items(id) on delete restrict,
  -- `special_categories.id` è testo ('cappotti', 'pelle'…), non un uuid.
  category_id     text references public.special_categories(id) on delete restrict,
  qty_per_ciclo   int not null check (qty_per_ciclo > 0),
  nota            text,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null,
  constraint capi_compresi_uno_solo check (num_nonnulls(item_id, category_id) = 1)
);

comment on table public.capi_compresi is
  'Quali capi comprende il canone di un abbonamento, per ciclo pagato. Il cliente non li paga; la lavanderia sì, perché il lavoro è stato fatto.';
comment on column public.capi_compresi.qty_per_ciclo is
  'Quante unità comprende il canone in un ciclo. Quello che avanza scade: non si riporta.';
comment on column public.capi_compresi.category_id is
  'In alternativa al capo preciso: «un capo fra i cappotti». Serve quando l''accordo è sul tipo di capo e non sulla voce di listino.';

-- Un diritto per capo e un diritto per categoria, e non due uguali.
create unique index if not exists capi_compresi_item_uniq
  on public.capi_compresi (subscription_id, item_id) where item_id is not null;
create unique index if not exists capi_compresi_cat_uniq
  on public.capi_compresi (subscription_id, category_id) where category_id is not null;
create index if not exists capi_compresi_sub_idx
  on public.capi_compresi (subscription_id);

alter table public.capi_compresi enable row level security;

create policy "capi compresi admin" on public.capi_compresi
  for all using (is_admin()) with check (is_admin());

-- Il cliente legge i suoi: è quello che ha comprato, e la 0087 ha già stabilito
-- che un numero promesso non è un dato interno da nascondere a chi l'ha pagato.
create policy "capi compresi del cliente" on public.capi_compresi
  for select using (
    subscription_id in (select id from public.subscriptions where user_id = auth.uid())
  );

-- Sulle righe dei capi: quante unità ha assorbito il canone, e quante se ne
-- pagano. `qty_inclusa` resta quello che è — le assorbite dalla franchigia del
-- sacco — perché è proprio la differenza fra le due a dire chi paga.
alter table public.order_specials
  add column if not exists qty_inclusa_canone int not null default 0
    check (qty_inclusa_canone >= 0);

comment on column public.order_specials.qty_inclusa is
  'Assorbite dalla franchigia del sacco (special_items.incluse_per_sacco): stanno DENTRO il compenso del sacco, alla lavanderia non si paga niente a parte.';
comment on column public.order_specials.qty_inclusa_canone is
  'Assorbite dai capi compresi nel canone: il cliente non le paga, la lavanderia sì — il lavoro è stato fatto. Stessa regola del capo regalato (0068).';

-- Quante unità si pagano alla lavanderia, calcolate dal database.
--
-- Generata e non scritta a mano perché la regola la leggono in cinque posti —
-- due che creano i compensi, il portale, lo storico e il proforma — e a
-- cinque copie basta che una resti indietro perché il bonifico non torni.
alter table public.order_specials
  add column if not exists qty_pagata int
    generated always as (qty + qty_inclusa_canone) stored;

comment on column public.order_specials.qty_pagata is
  'Quante unità si pagano alla lavanderia: addebitate + comprese nel canone. Le comprese nel sacco restano fuori, sono già dentro il compenso del sacco.';

-- La somma deve tornare: trovate = addebitate + comprese nel sacco + comprese
-- nel canone. `not valid` perché le righe storiche hanno `qty_totale` nullo o
-- corretto a mano e non vanno rifiutate ora; da qui in avanti il conto torna.
alter table public.order_specials
  drop constraint if exists order_specials_somma_quantita;
alter table public.order_specials
  add constraint order_specials_somma_quantita
  check (qty_totale is null or qty + qty_inclusa + qty_inclusa_canone = qty_totale) not valid;

-- La lavanderia deve vedere il suo compenso vero.
--
-- Senza questa riga, sei maglie comprese nel canone le comparirebbero come
-- 0,00 € — su un lavoro che le paghiamo 17,22 €. La vista espone `qty_pagata`
-- accanto a `qty`, e il prezzo al cliente resta fuori come è sempre stato.
-- Si rifà **identica** alla 0094 con una colonna in più: stesse righe, stesse
-- condizioni, stesso `security_barrier`. Cambiare qui anche una `where`
-- vorrebbe dire muovere il tabellone della lavanderia mentre si sistema un
-- compenso, e i due guasti sembrerebbero uno solo.
create or replace view partner_order_specials
with (security_barrier = true) as
  select
    os.id                      as id,
    os.order_id                as order_id,
    p.client_code              as client_code,
    os.item_name               as item_name,
    os.qty                     as qty,
    os.comp_lav_cents          as comp_lav_cents, -- solo compenso; mai price_cli
    os.charged_at              as charged_at,
    os.created_at              as created_at,
    os.dichiarato_dal_cliente  as dichiarato_dal_cliente,
    -- In fondo e non accanto a `qty`: `create or replace view` non sa
    -- infilare una colonna in mezzo, e per spostarla bisognerebbe cancellare
    -- la vista mentre il portale la sta leggendo.
    os.qty_pagata              as qty_pagata
  from order_specials os
  join orders o   on o.id = os.order_id
  join profiles p on p.id = o.customer_id
  where o.laundry_id = my_laundry_id();

revoke all on partner_order_specials from anon;
grant select on partner_order_specials to authenticated;
