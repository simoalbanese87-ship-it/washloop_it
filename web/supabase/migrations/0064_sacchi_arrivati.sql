-- Alla lavanderia si paga quello che è arrivato, non quello che era previsto.
--
-- Il difetto, visto l'8 settembre
-- -------------------------------
-- Fabia ha un abbonamento da 2 sacchi e in prenotazione ne risultavano 2. Ne ha
-- consegnato **uno**. Il portale della lavanderia scriveva «2 SACCHI», e il
-- compenso — che si calcola sui sacchi — sarebbe stato liquidato su due.
--
-- La causa è che `orders.bags` fa due mestieri incompatibili:
--
--   1. **quanti sacchi aspettarsi**, scritto in prenotazione o copiato dalla
--      ricorrenza. Serve a organizzare il giro, ed è una stima di giorni prima;
--   2. **quanti sacchi sono arrivati davvero**, che è l'unico numero con cui si
--      paga qualcuno.
--
-- Finché i due coincidono nessuno se ne accorge. Quando divergono vince sempre
-- la stima, perché è quella scritta nella colonna: la scansione del rider alza
-- il numero se i sacchi sono di più, ma non lo abbassa mai se sono di meno.
--
-- Perché non basta contare le scansioni
-- --------------------------------------
-- Il conteggio delle borse in `order_bags` è più vicino al vero, ma non è la
-- verità: l'8 settembre alle 11:03, a giro finito, sono comparse due scansioni
-- a dodici secondi l'una dall'altra su due clienti diversi — una borsa in più
-- per fabia e una per Giulia. Una scansione si può fare per sbaglio, e non c'è
-- modo di distinguerla da quella buona guardando solo il database.
--
-- Chi lo sa per certo è **chi ha i sacchi sul banco**. La lavanderia li conta
-- per aprirli, e li conta comunque: è l'unico punto della catena in cui il
-- numero è un fatto osservato invece che una previsione o un gesto. Ed è anche
-- la parte che ci viene pagata, quindi ha tutte le ragioni per contare bene —
-- e noi otteniamo un controllo incrociato sul rider senza chiedere lavoro in
-- più a nessuno.

alter table public.orders
  add column bags_arrivati int check (bags_arrivati is null or bags_arrivati >= 0),
  add column bags_arrivati_at timestamptz,
  add column bags_arrivati_by uuid references public.profiles(id) on delete set null;

comment on column public.orders.bags_arrivati is
  'Quanti sacchi la lavanderia ha contato sul banco. NULL finché non lo conferma. È questo il numero con cui si paga: bags resta la previsione.';

-- O il conteggio c'è con chi e quando l'ha fatto, o non c'è. Una quantità senza
-- firma non si può difendere davanti a chi contesta il compenso.
alter table public.orders
  add constraint orders_bags_arrivati_firmato
  check (
    (bags_arrivati is null and bags_arrivati_at is null)
    or (bags_arrivati is not null and bags_arrivati_at is not null)
  );

-- La vista del portale porta tutti e tre i numeri, così la lavanderia vede
-- insieme cosa aspettavamo, cosa ha scansionato il rider e cosa ha contato lei.
-- Prima ne mostrava uno solo — e per giunta quello sbagliato.
drop view if exists public.partner_orders;

create view public.partner_orders
with (security_invoker = false) as
  select o.id as order_id,
         p.client_code,
         o.bags,
         -- Quante borse ha registrato il rider passando.
         (select count(*) from public.order_bags b
           where b.order_id = o.id and b.pickup_scanned_at is not null) as bags_scansionati,
         o.bags_arrivati,
         o.bags_arrivati_at,
         o.service,
         o.fragrance,
         o.status,
         o.eta_ready_at,
         o.created_at,
         z.name as zone_name
    from public.orders o
    join public.profiles p on p.id = o.customer_id
    left join public.addresses a on a.id = o.address_id
    left join public.zones z on z.id = a.zone_id
   where o.laundry_id = my_laundry_id()
     and not coalesce(p.is_test, false);

grant select on public.partner_orders to authenticated;

-- Il conteggio della lavanderia sui due ordini di oggi, dove lo sappiamo già.
-- Fabia: un sacco solo, l'ha detto lei. Giulia resta senza conferma, perché
-- nessuno ha ancora contato i suoi — e inventare un numero qui sarebbe
-- esattamente l'errore che questa migrazione toglie di mezzo.
update public.orders
   set bags_arrivati = 1, bags_arrivati_at = now()
 where id = '068b842a-f523-45c8-8597-bfee39b881c1';
