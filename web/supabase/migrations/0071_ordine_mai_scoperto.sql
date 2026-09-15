-- Un ordine non può nascere senza lavanderia e senza rider.
--
-- Perché non basta averlo già sistemato
-- -------------------------------------
-- È la seconda volta. Il ripiego sulla lavanderia c'era da settimane
-- (`lib/lavanderia.ts`), e il 14 settembre due ritiri sono nati scoperti lo
-- stesso: veniva chiesto con la sessione di chi prenota, e su `laundries`
-- leggono solo rider, lavanderia e admin. La query non falliva — **tornava
-- vuota** — e «nessuna lavanderia attiva» veniva letto come «non c'è un
-- ripiego».
--
-- Il difetto vero non è la riga sbagliata: è che la garanzia viveva nel codice
-- chiamante. Ogni nuovo punto di creazione — una prenotazione, un cron, un
-- inserimento a mano dal pannello, uno script — deve ricordarsene, e chi la
-- dimentica non se ne accorge: non c'è errore, c'è solo un sacco che arriva sul
-- banco senza comparire in nessuna lista.
--
-- Qui la regola sta **sotto** tutti i chiamanti. `security definer` di
-- proposito: è l'unico modo perché la lettura delle lavanderie e delle zone non
-- dipenda dai permessi di chi sta inserendo — che è esattamente ciò che si è
-- rotto.
--
-- Le regole sono le stesse di prima, non nuove:
--   * lavanderia: si aggancia **solo se di attiva ce n'è esattamente una**. Con
--     due, la scelta esiste davvero e la fa una persona.
--   * rider: quello della zona dell'indirizzo; in mancanza, se tutte le zone
--     attive hanno lo stesso rider, quello. È la clausola momentanea descritta
--     in `lib/rider-predefinito.ts`, e si spegne da sé alle stesse condizioni.
--
-- Non sovrascrive mai una scelta già fatta: agisce solo su un campo nullo.

create or replace function public.aggancia_ordine_scoperto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n_lav int;
  lav uuid;
  rid uuid;
  zone_totali int;
  zone_scoperte int;
  rider_distinti int;
begin
  if new.laundry_id is null then
    select count(*), (array_agg(id))[1] into n_lav, lav
      from public.laundries where active;
    if n_lav = 1 then
      new.laundry_id := lav;
    end if;
  end if;

  if new.courier_id is null and new.address_id is not null then
    -- 1. il rider della zona dell'indirizzo
    select z.courier_id into rid
      from public.addresses a
      join public.zones z on z.id = a.zone_id
     where a.id = new.address_id;

    -- 2. la clausola: tutte le zone attive coperte, e dallo stesso rider
    if rid is null then
      select count(*), count(*) filter (where courier_id is null), count(distinct courier_id)
        into zone_totali, zone_scoperte, rider_distinti
        from public.zones where active;
      if zone_totali > 0 and zone_scoperte = 0 and rider_distinti = 1 then
        select (array_agg(courier_id))[1] into rid from public.zones where active;
      end if;
    end if;

    new.courier_id := rid;
  end if;

  return new;
end;
$$;

comment on function public.aggancia_ordine_scoperto is
  'Riempie laundry_id e courier_id quando l''ordine nasce senza. La garanzia sta qui e non nei chiamanti perché un ordine scoperto non dà errore: sparisce e basta.';

drop trigger if exists ordine_mai_scoperto on public.orders;
create trigger ordine_mai_scoperto
  before insert on public.orders
  for each row execute function public.aggancia_ordine_scoperto();
