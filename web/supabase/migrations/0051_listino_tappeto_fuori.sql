-- Il tappeto esce dal listino dei capi speciali.
--
-- Scelta operativa: un tappeto non è un capo, ingombra come nient'altro nel
-- sacco e nel furgone, e alla partenza del servizio complica il giro senza
-- portare margine (2,87 € alla lavanderia su 4,90 € al cliente). Meglio non
-- prometterlo che prometterlo e gestirlo male.
--
-- Si disattiva, non si cancella: `order_specials` può già riferirlo per un
-- ordine passato, e la riga serve a rileggere quello storico. `active = false`
-- lo toglie dalla vista `special_items_public`, quindi sparisce dal listino
-- del cliente e da quello della lavanderia, ma resta leggibile all'indietro.
-- Per rimetterlo un giorno basta riportare `active` a true.

update public.special_items
   set active = false
 where name = 'Tappeto';
