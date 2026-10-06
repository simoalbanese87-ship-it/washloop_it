-- 0024 — Enforcement capacità slot (anti-overbooking).
--
-- Finora `slots.capacity` veniva scritto ma mai letto: un slot poteva ricevere
-- ordini illimitati (anche dal cron). Questo trigger conta gli ordini NON
-- annullati già agganciati allo slot e blocca l'inserimento/aggancio oltre la
-- capacità. È il backstop DB: vale per prenotazione cliente, consegna e cron.
--
-- Nota: il conteggio non è sotto lock, quindi due prenotazioni simultanee sullo
-- stesso ultimo posto potrebbero passare entrambe (sforo max +1). Accettabile ai
-- volumi attuali; l'app mostra comunque i posti residui e nasconde i pieni.

create or replace function enforce_slot_capacity() returns trigger
language plpgsql as $$
declare cap int; used int;
begin
  -- Ritiro
  if new.pickup_slot_id is not null and new.status <> 'cancelled'
     and (tg_op = 'INSERT'
          or new.pickup_slot_id is distinct from old.pickup_slot_id
          or (old.status = 'cancelled' and new.status <> 'cancelled')) then
    select capacity into cap from slots where id = new.pickup_slot_id;
    if cap is not null then
      select count(*) into used from orders
        where pickup_slot_id = new.pickup_slot_id and status <> 'cancelled' and id <> new.id;
      if used >= cap then raise exception 'SLOT_PICKUP_FULL'; end if;
    end if;
  end if;

  -- Consegna
  if new.delivery_slot_id is not null and new.status <> 'cancelled'
     and (tg_op = 'INSERT'
          or new.delivery_slot_id is distinct from old.delivery_slot_id
          or (old.status = 'cancelled' and new.status <> 'cancelled')) then
    select capacity into cap from slots where id = new.delivery_slot_id;
    if cap is not null then
      select count(*) into used from orders
        where delivery_slot_id = new.delivery_slot_id and status <> 'cancelled' and id <> new.id;
      if used >= cap then raise exception 'SLOT_DELIVERY_FULL'; end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_slot_capacity on orders;
create trigger trg_slot_capacity before insert or update on orders
  for each row execute function enforce_slot_capacity();
