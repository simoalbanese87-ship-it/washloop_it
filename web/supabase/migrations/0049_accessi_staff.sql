-- Gli accessi staff nascevano col ruolo sbagliato e non si riuscivano a
-- eliminare. Due cause distinte, entrambe silenziose.
--
-- 1. Il trigger che protegge le colonne privilegiate di `profiles` lascia
--    passare solo chi è amministratore secondo `is_admin()`, che legge
--    `auth.uid()`. Le server action del pannello scrivono con la service key,
--    che non ha nessuna sessione: `auth.uid()` è null, `is_admin()` è false, e
--    l'assegnazione del ruolo veniva rifiutata. L'account veniva creato e
--    restava `customer`, quindi spariva dall'elenco dello staff pur esistendo.
--    Il backend che parla con la service key è già fidato per costruzione —
--    bypassa RLS — quindi bloccarlo qui non proteggeva niente.
--
-- 2. Eliminare un rider falliva se aveva anche un solo ordine assegnato:
--    `orders.courier_id` puntava a `profiles` con `NO ACTION`. Lo stesso per
--    l'autore di un evento, di un capo speciale o di un addebito. La storia di
--    un ordine deve sopravvivere a chi non lavora più con noi: l'ordine resta,
--    torna semplicemente senza rider e va riassegnato.

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Il backend fidato (service key) e gli amministratori possono toccare
  -- ruolo, lavanderia e codice cliente. Tutti gli altri no.
  if coalesce(auth.role(), '') = 'service_role' or is_admin() then
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

-- Chi se ne va non porta via gli ordini: restano, senza rider.
alter table public.orders drop constraint if exists orders_courier_id_fkey;
alter table public.orders
  add constraint orders_courier_id_fkey
  foreign key (courier_id) references public.profiles(id) on delete set null;

-- La storia resta leggibile anche senza il nome di chi l'ha scritta.
alter table public.order_events drop constraint if exists order_events_actor_id_fkey;
alter table public.order_events
  add constraint order_events_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;

alter table public.order_specials drop constraint if exists order_specials_added_by_fkey;
alter table public.order_specials
  add constraint order_specials_added_by_fkey
  foreign key (added_by) references public.profiles(id) on delete set null;

alter table public.customer_charges drop constraint if exists customer_charges_created_by_fkey;
alter table public.customer_charges
  add constraint customer_charges_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;
