-- Due fasce identiche non sono due fasce.
-- =======================================
--
-- Perché
-- ------
-- Su `slots` non c'è mai stato nessun vincolo di unicità: generare due volte lo
-- stesso intervallo, o premere due volte «Aggiungi», crea righe gemelle senza
-- dire niente. È successo sul venerdì, che si è ritrovato **due** fasce
-- 09:00–13:00 identiche: in app il cliente vede due riquadri uguali e non sa
-- quale scegliere, e il conteggio dei posti si divide fra due fasce quando il
-- giro è uno solo.
--
-- Qui si fanno due cose: si archiviano i doppioni già in giro tenendo **la riga
-- a cui sono agganciati degli ordini** (e, a parità, la prima per id) — perché
-- archiviare quella usata lascerebbe degli ordini appesi a una fascia morta — e
-- si mette il vincolo perché non ne nascano altri.
--
-- `archived_at` e non `delete`: è la regola della casa sulle fasce, e un ordine
-- che punta a una fascia cancellata resterebbe senza orario.

update public.slots s
   set archived_at = now()
 where s.archived_at is null
   and exists (
     select 1
       from public.slots piu_vecchia
      where piu_vecchia.archived_at is null
        and piu_vecchia.kind = s.kind
        and piu_vecchia.starts_at = s.starts_at
        and piu_vecchia.ends_at = s.ends_at
        and piu_vecchia.laundry_id is not distinct from s.laundry_id
        and piu_vecchia.servizio is not distinct from s.servizio
        -- Vince chi ha ordini attaccati; a parità, la prima in ordine di id.
        and (
          (select count(*) from public.orders o where o.pickup_slot_id = piu_vecchia.id or o.delivery_slot_id = piu_vecchia.id),
          piu_vecchia.id::text
        ) > (
          (select count(*) from public.orders o where o.pickup_slot_id = s.id or o.delivery_slot_id = s.id),
          s.id::text
        )
   );

-- `is not distinct from` non si può usare in un indice: si normalizzano i due
-- campi facoltativi con `coalesce`, che per un uuid vuole un uuid finto — zero,
-- che non può essere l'id di nessuna lavanderia vera.
create unique index if not exists slots_senza_doppioni
  on public.slots (
    kind,
    starts_at,
    ends_at,
    coalesce(laundry_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(servizio, '')
  )
  where archived_at is null;

comment on index public.slots_senza_doppioni is
  'Una fascia sola per (tipo, orario, lavanderia, servizio) fra quelle vive. Le archiviate restano, anche in copie: sono storia.';
