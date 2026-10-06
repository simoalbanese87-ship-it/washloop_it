-- 0037_security_hardening.sql
-- Tre falle chiuse prima dell'apertura al pubblico. Tutte verificate in produzione.
--
-- 1) profiles: la policy "self update" permetteva al cliente di aggiornare QUALSIASI
--    colonna della propria riga, `role` inclusa. Con la anon key (pubblica per
--    definizione) chiunque poteva farsi admin dal browser.
-- 2) zone_caps: creata in 0026 senza RLS. Con i grant di default, anon e
--    authenticated avevano INSERT/UPDATE/DELETE/TRUNCATE sulla mappa CAP→zona.
-- 3) proofs: bucket pubblico. Le foto scattate davanti alle case dei clienti
--    erano leggibili da chiunque conoscesse l'URL, che è prevedibile.
--
-- In più: il cliente poteva portarsi l'ordine a "consegnato" (policy senza
-- vincolo di colonna), e il corriere non riusciva a leggere nome e telefono del
-- cliente che deve andare a trovare.

-- ---------------------------------------------------------------------------
-- 1) profiles — nessuno si promuove da solo
-- ---------------------------------------------------------------------------

-- La guardia sta in un trigger e non solo nella policy: regge anche se domani
-- qualcuno riscrive le policy senza accorgersi del vincolo.
create or replace function profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.laundry_id is distinct from old.laundry_id
     or new.client_code is distinct from old.client_code then
    raise exception 'Solo un amministratore può modificare ruolo, lavanderia o codice cliente.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_privileged on profiles;
create trigger profiles_guard_privileged
  before update on profiles
  for each row execute function profiles_guard_privileged_columns();

-- ---------------------------------------------------------------------------
-- 2) zone_caps — lettura a tutti (serve al form di copertura), scrittura admin
-- ---------------------------------------------------------------------------

alter table zone_caps enable row level security;

drop policy if exists "zone_caps read" on zone_caps;
create policy "zone_caps read" on zone_caps for select using (true);

drop policy if exists "zone_caps admin write" on zone_caps;
create policy "zone_caps admin write" on zone_caps for all
  using (is_admin()) with check (is_admin());

-- I grant di default restano larghi: la RLS ora li governa, ma togliere il
-- superfluo costa nulla e riduce la superficie.
revoke insert, update, delete, truncate on zone_caps from anon;
revoke truncate on zone_caps from authenticated;

-- ---------------------------------------------------------------------------
-- 3) proofs — bucket privato, si serve con signed URL
-- ---------------------------------------------------------------------------

update storage.buckets set public = false where id = 'proofs';

drop policy if exists "proofs read" on storage.objects;

-- Lettura ristretta a chi ha davvero a che fare con quell'ordine. Il path è
-- "<order_id>/<file>", quindi la prima cartella identifica l'ordine.
create policy "proofs read scoped" on storage.objects for select using (
  bucket_id = 'proofs' and (
    is_admin()
    or exists (
      select 1 from orders o
      where o.id::text = (storage.foldername(name))[1]
        and (o.customer_id = auth.uid() or o.courier_id = auth.uid() or o.laundry_id = my_laundry_id())
    )
  )
);

-- ---------------------------------------------------------------------------
-- 4) orders — il cliente non avanza il proprio ordine
-- ---------------------------------------------------------------------------

-- Il cliente prenota e disdice tramite server action (service role): non ha mai
-- avuto bisogno dell'UPDATE diretto. Lasciarglielo significava permettergli di
-- marcare l'ordine "consegnato" senza che nulla fosse stato ritirato.
drop policy if exists "orders customer update" on orders;

-- ---------------------------------------------------------------------------
-- 5) profiles — il corriere vede i contatti di chi ha in giro, e solo quelli
-- ---------------------------------------------------------------------------

-- Finora la query di /courier chiedeva nome e telefono del cliente ma la policy
-- non glieli dava: l'embed tornava null e il pulsante "chiama" era morto.
drop policy if exists "profiles courier reads own jobs" on profiles;
create policy "profiles courier reads own jobs" on profiles for select using (
  exists (
    select 1 from orders o
    where o.customer_id = profiles.id
      and o.courier_id = auth.uid()
      and o.status not in ('delivered', 'completed', 'cancelled')
  )
);

-- ---------------------------------------------------------------------------
-- 6) laundry_payouts — aveva RLS attiva e zero policy: inaccessibile a tutti
-- ---------------------------------------------------------------------------

drop policy if exists "laundry_payouts admin" on laundry_payouts;
create policy "laundry_payouts admin" on laundry_payouts for all
  using (is_admin()) with check (is_admin());

drop policy if exists "laundry_payouts partner read" on laundry_payouts;
create policy "laundry_payouts partner read" on laundry_payouts for select
  using (laundry_id = my_laundry_id());
