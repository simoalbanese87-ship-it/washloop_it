-- Quanti sacchi comprende l'abbonamento, quando il piano non lo dice.
--
-- Perché
-- ------
-- Il costo previsto in /admin/competenza esisteva per confrontare quello che ci
-- aspettiamo di pagare alla lavanderia con quello che paghiamo davvero. Ne
-- contava un cliente su cinque: gli abbonamenti a prezzo concordato non hanno
-- un piano collegato, quindi non hanno un numero di sacchi, quindi restavano
-- fuori dal conto. Il confronto fra previsto ed effettivo era il motivo per cui
-- quella pagina esiste, e non lo faceva.
--
-- Collegare un piano non era la strada: il prezzo di quegli abbonamenti è
-- concordato uno per uno (30 €, 60 €, 60 €) e nessun piano lo replica. Il
-- numero di sacchi va dove sta già l'altra metà dell'accordo, cioè sulla riga
-- dell'abbonamento, accanto a `custom_price_cents`.
--
-- L'ordine delle fonti, che da qui in poi è uno solo:
--   subscriptions.bags_per_week  -- l'accordo con questa persona
--   plans.bags_per_week          -- quello che ha comprato a listino
--   recurring_pickups.bags       -- ripiego osservativo
--   null                         -- non lo sappiamo, e non si inventa
-- La stessa catena in TypeScript sta in src/lib/tetto-sacchi.ts, con i test.
--
-- Perché il check e non solo la validazione nella UI
-- -------------------------------------------------
-- `sacchiDaContare` (src/lib/franchigia.ts) scarta solo i numeri negativi: uno
-- zero passerebbe come tetto valido e azzererebbe il compenso alla lavanderia e
-- la franchigia sulle camicie, in silenzio. «Zero sacchi compresi» non è un
-- abbonamento che esiste, è un campo compilato male.

alter table public.subscriptions
  add column if not exists bags_per_week int;

alter table public.subscriptions
  drop constraint if exists subscriptions_bags_per_week_positivo;

alter table public.subscriptions
  add constraint subscriptions_bags_per_week_positivo
  check (bags_per_week is null or bags_per_week > 0);

comment on column public.subscriptions.bags_per_week is
  'I sacchi a settimana concordati con questa persona. Vince sul piano: è l''unico numero che qualcuno ha scritto di proposito per lei. null significa «vale il piano, o in mancanza la ricorrenza», non zero.';

-- Backfill: si copia il numero **già in vigore oggi** per il tetto.
--
-- Quei valori arrivano da `recurring_pickups`, che è la fonte che sacchiInclusi
-- usa adesso per chi non ha un piano: promuoverli ad accordo non cambia nessun
-- compenso e nessuna franchigia, cambia solo da dove viene il numero. Niente
-- nomi propri qui dentro: gli id cambiano fra ambienti, e una migration che
-- nomina i clienti non si può rileggere fra un anno.
--
-- Verificato in produzione prima di applicare: fabia 2, Saverio 1, federica 1.
-- Giulia ha il piano Small e resta fuori, perché il piano già lo dice.
update public.subscriptions s
   set bags_per_week = (
         select r.bags from public.recurring_pickups r
          where r.customer_id = s.user_id and r.active
          order by r.created_at desc limit 1)
 where s.bags_per_week is null
   and s.plan_id is null
   and s.custom_price_cents is not null
   and s.status in ('active','trialing')
   and exists (select 1 from public.recurring_pickups r
                where r.customer_id = s.user_id and r.active and r.bags > 0);

-- La vista del portale lavanderia deve usare la stessa catena, o la lavanderia
-- vede un tetto e noi ne paghiamo un altro.
--
-- Attenzione a chi legge: questa è una **copia** della logica di
-- src/lib/tetto-sacchi.ts, e la vista non ha test. Cambiando una delle due,
-- cambiare anche l'altra. (Chiuderla per sempre vorrebbe dire una funzione SQL
-- condivisa: è il seguito naturale, non questo lavoro.)
--
-- `create or replace` basta: la colonna resta al suo posto e dello stesso tipo.
create or replace view public.partner_orders
with (security_invoker = off) as
  select o.id as order_id,
         p.client_code,
         o.bags,
         (select count(*) from public.order_bags b
           where b.order_id = o.id and b.pickup_scanned_at is not null) as bags_scansionati,
         o.bags_arrivati,
         o.bags_arrivati_at,
         coalesce(
           (select nullif(s.bags_per_week, 0)
              from public.subscriptions s
             where s.user_id = o.customer_id and s.status in ('active','trialing')
             order by s.created_at desc limit 1),
           (select nullif(pl.bags_per_week, 0)
              from public.subscriptions s
              join public.plans pl on pl.id = s.plan_id
             where s.user_id = o.customer_id and s.status in ('active','trialing')
             order by s.created_at desc limit 1),
           (select nullif(r.bags, 0)
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
  'Gli ordini della lavanderia che ha fatto accesso, senza dati personali del cliente. `sacchi_inclusi` è il tetto dell''abbonamento: si paga e si conta la franchigia sul minore fra questo e i sacchi osservati. Le fonti, in ordine: accordo sull''abbonamento, piano, ritiro settimanale.';
