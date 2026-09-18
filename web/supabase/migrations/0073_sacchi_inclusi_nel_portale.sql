-- Quanti sacchi comprende l'abbonamento, anche nel portale della lavanderia.
--
-- Perché
-- ------
-- Il numero di sacchi con cui paghiamo, e su cui si conta la franchigia delle
-- camicie, non è quello che risulta: è quello **dovuto**, cioè il minore fra
-- ciò che si è osservato e ciò che l'abbonamento comprende. Le prove che
-- raccogliamo — tag letti dal rider, conteggio sul banco, previsione della
-- prenotazione — possono dire di più di quanto il contratto dia: un tag passato
-- due volte, due etichette su un sacco solo, una prenotazione compilata a caso.
--
-- L'8 settembre l'ordine di Giulia — piano Small, un sacco — è stato pagato
-- 24,60 €, cioè due, perché il rider aveva letto due tag e nessuno ha guardato
-- il piano.
--
-- La lavanderia quel tetto lo deve vedere: è lei che conta i sacchi sul banco,
-- e senza il numero a schermo non può sapere che scriverne tre su un
-- abbonamento da uno non cambia il compenso.
--
-- Privacy invariata
-- -----------------
-- Si aggiunge un numero, non un dato personale: nessun nome, nessun indirizzo,
-- nessun prezzo al cliente. Resta il filtro su `my_laundry_id()` e
-- l'esclusione dei profili di prova.
--
-- Le due fonti, in ordine: il piano collegato all'abbonamento; in mancanza, il
-- ritiro settimanale. Oggi quattro clienti su cinque hanno un abbonamento a
-- prezzo personalizzato senza piano collegato, e senza il ripiego per loro il
-- tetto non esisterebbe. `null` significa «non lo sappiamo»: chi legge conta
-- quello che ha osservato e lo dichiara, invece di inventare un numero.

-- `drop` e non `create or replace`: Postgres rifiuta di sostituire una vista
-- se le colonne nuove non finiscono in coda, e questa va inserita accanto agli
-- altri conteggi, dove chi legge la cerca. La vista non contiene dati propri —
-- è una lettura — quindi ricrearla non perde niente.
drop view if exists public.partner_orders;

create view public.partner_orders
with (security_invoker = off) as
  select o.id as order_id,
         p.client_code,
         o.bags,
         (select count(*) from public.order_bags b
           where b.order_id = o.id and b.pickup_scanned_at is not null) as bags_scansionati,
         o.bags_arrivati,
         o.bags_arrivati_at,
         coalesce(
           (select pl.bags_per_week
              from public.subscriptions s
              join public.plans pl on pl.id = s.plan_id
             where s.user_id = o.customer_id and s.status in ('active','trialing')
             order by s.created_at desc limit 1),
           (select r.bags
              from public.recurring_pickups r
             where r.customer_id = o.customer_id and r.active
             order by r.created_at desc limit 1)
         ) as sacchi_inclusi,
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

comment on view public.partner_orders is
  'Gli ordini della lavanderia che ha fatto accesso, senza dati personali del cliente. `sacchi_inclusi` è il tetto dell''abbonamento: si paga e si conta la franchigia sul minore fra questo e i sacchi osservati.';
