-- I capi che dichiara il cliente, non la lavanderia.
-- ==================================================
--
-- Perché
-- ------
-- Finora in `order_specials` ci finiva solo quello che la lavanderia trovava
-- nel sacco: `added_by` è il profilo di chi l'ha registrato, cioè sempre uno
-- del banco. Da oggi anche il cliente può dire, mentre prenota, che cosa sta
-- mettendo dentro — «un piumone» — e quella riga nasce prima che il sacco
-- esista.
--
-- Serve distinguerle, e non basta `added_by`: chi guarda l'ordine — l'ops o la
-- lavanderia — deve sapere se quel capo **l'ha visto qualcuno** o se è una
-- dichiarazione da verificare. Sono due gradi di certezza diversi, e sulle
-- stesse righe si decide un addebito.
--
-- L'addebito non cambia: parte dove parte oggi, quando la lavanderia ha contato
-- i sacchi. Fino a lì la riga si corregge o si toglie.

alter table public.order_specials
  add column if not exists dichiarato_dal_cliente boolean not null default false;

comment on column public.order_specials.dichiarato_dal_cliente is
  'true = l''ha scritto il cliente prenotando, nessuno l''ha ancora visto. false = l''ha registrato la lavanderia con il capo in mano.';

create index if not exists order_specials_dichiarati_idx
  on public.order_specials (order_id)
  where dichiarato_dal_cliente;

-- La lavanderia deve vedere la differenza: un capo scritto dal cliente è una
-- cosa da verificare, uno registrato al banco è una cosa vista. La vista del
-- partner si rifà con la colonna in più — e basta quella, perché il resto
-- (niente nome del cliente, niente prezzo cliente) resta identico.
create or replace view partner_order_specials
with (security_barrier = true) as
  select
    os.id                      as id,
    os.order_id                as order_id,
    p.client_code              as client_code,
    os.item_name               as item_name,
    os.qty                     as qty,
    os.comp_lav_cents          as comp_lav_cents,  -- solo compenso; mai price_cli
    os.charged_at              as charged_at,
    os.created_at              as created_at,
    os.dichiarato_dal_cliente  as dichiarato_dal_cliente
  from order_specials os
  join orders o   on o.id = os.order_id
  join profiles p on p.id = o.customer_id
  where o.laundry_id = my_laundry_id();

revoke all on partner_order_specials from anon;
grant select on partner_order_specials to authenticated;
