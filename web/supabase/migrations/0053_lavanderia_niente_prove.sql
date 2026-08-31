-- In lavanderia arrivano solo sacchi che esistono davvero.
--
-- Il primo giorno di lavoro vero, il portale del partner mostrava tre ordini —
-- tutti di `Mario Test`, tutti di prova, tutti con date di due settimane prima —
-- e nessun modo di capire che non fossero reali. Chi apre quel pannello legge
-- «WL-3697 · 3 sacchi · pronto entro ven 14/08» e va a cercarli sul bancone.
--
-- Il pannello admin ha ovunque l'interruttore «mostra dati di prova», perché lì
-- i profili finti servono. Qui no: la lavanderia non fa prove, lava. Il filtro
-- è quindi definitivo e non opzionale, e vale SOLO per questa vista — altrove
-- i dati di prova restano visibili come prima.
--
-- Si filtra il PROFILO e non l'ordine: `is_test` sta sulla persona, e un
-- profilo di prova non genera mai lavoro reale.

create or replace view public.partner_orders
with (security_barrier = true) as
  select o.id as order_id,
         p.client_code,
         o.bags,
         o.service,
         o.fragrance,
         o.status,
         o.eta_ready_at,
         o.created_at,
         z.name as zone_name
    from orders o
    join profiles p on p.id = o.customer_id
    left join addresses a on a.id = o.address_id
    left join zones z on z.id = a.zone_id
   where o.laundry_id = my_laundry_id()
     and not coalesce(p.is_test, false);

comment on view public.partner_orders is
  'Ordini della lavanderia collegata. Esclude i profili di prova: in lavanderia arriva solo lavoro vero.';
