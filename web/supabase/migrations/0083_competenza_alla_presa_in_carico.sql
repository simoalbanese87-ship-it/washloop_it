-- La competenza dei compensi lavanderia e' la presa in carico, non la riconsegna
-- =============================================================================
--
-- Un ordine ritirato il 29 settembre e riconsegnato il 2 ottobre finiva nel
-- proforma di ottobre, perche' `servizio_il` veniva dalla riconsegna. Ma la
-- lavanderia quel lavoro lo ha fatto a settembre: il costo nasce quando la roba
-- entra, non quando esce. Il 1 ottobre erano 20,50 EUR di capi speciali nel mese
-- sbagliato.
--
-- Da qui in avanti lo decide `giornoDiCompetenza` (ritiro, poi riconsegna, poi
-- data dell'ordine). Questa migration riallinea le righe gia' scritte, cosi' il
-- registro e' coerente con la regola e non resta un prima e un dopo che nessuno
-- ricorda.
--
-- Le righe gia' liquidate (`settled`) NON si toccano: spostarle cambierebbe il
-- mese di un proforma gia' pagato, cioe' un documento che esiste fuori di qui.

update public.laundry_payouts lp
set servizio_il = coalesce(
      (sp.starts_at at time zone 'UTC')::date,
      (sd.starts_at at time zone 'UTC')::date,
      o.created_at::date
    )
from public.orders o
  left join public.slots sp on sp.id = o.pickup_slot_id
  left join public.slots sd on sd.id = o.delivery_slot_id
where lp.order_id = o.id
  and lp.status <> 'settled'
  and lp.servizio_il is distinct from coalesce(
      (sp.starts_at at time zone 'UTC')::date,
      (sd.starts_at at time zone 'UTC')::date,
      o.created_at::date
    );

comment on column public.laundry_payouts.servizio_il is
  'Giorno di competenza del compenso: la presa in carico (il ritiro), non il giorno in cui la riga e'' stata scritta.';
