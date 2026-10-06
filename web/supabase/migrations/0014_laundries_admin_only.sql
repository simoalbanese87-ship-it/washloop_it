-- 0014 — Blinda l'identità delle lavanderie.
-- I clienti non devono MAI sapere quale lavanderia lavora i loro capi.
-- Prima la SELECT era aperta a tutti ("laundries read" using true): la togliamo.
-- Restano gli admin (policy "laundries admin" = is_admin() per ogni operazione).
-- Il portale partner usa viste dedicate (0008/0009), non questa tabella, quindi
-- non si rompe. Il routing cliente ricava la lavanderia dallo slot scelto
-- (slots.laundry_id), senza mai leggere nome/indirizzo della lavanderia.

drop policy if exists "laundries read" on laundries;
