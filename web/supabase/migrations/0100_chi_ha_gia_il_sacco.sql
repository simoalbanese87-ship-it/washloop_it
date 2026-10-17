-- Chi ha già il sacco: si deduce dalle consegne, non si chiede.
-- =============================================================
--
-- La 0099 ha aggiunto `borsa_consegnata_at`, e per tutti è nulla. Preso alla
-- lettera significa «nessuno dei clienti attivi ha un sacco», che è falso: il
-- sacco è il modo in cui il bucato viaggia, quindi chi ha ricevuto almeno una
-- riconsegna ce l'ha per forza. Senza questa riga i compiti nati stanotte
-- direbbero al rider di portare un sacco a sette persone che l'hanno già, e
-- una lista con sette righe sbagliate su nove non la guarda più nessuno.
--
-- Perché la data è quella e non oggi
-- ----------------------------------
-- La colonna dice **quando** gliel'abbiamo dato, e serve a sapere da quanto
-- quel cliente è in strada. Scrivere oggi sarebbe comodo e falso. Si usa la
-- data dei cartellini, che gli sono stati portati nello stesso giro; dove non
-- ci sono, la data della sua prima riconsegna, che è il momento più tardi in
-- cui il sacco era certamente a casa sua.
--
-- Non è un'invenzione: è lo stesso principio dei passaggi, che si contano dagli
-- ordini perché gli ordini sono il fatto. Qui il fatto è la riconsegna.
--
-- Vale una volta sola: `where borsa_consegnata_at is null`. Da domani la
-- colonna la scrive la spunta del rider.

update public.profiles p
   set borsa_consegnata_at = coalesce(
         p.tags_delivered_at,
         (select min(o.created_at) from public.orders o
           where o.customer_id = p.id and o.status in ('delivered', 'completed'))
       ),
       borsa_qty = coalesce(p.borsa_qty, p.tags_qty, 1)
 where p.role = 'customer'
   and p.borsa_consegnata_at is null
   and coalesce(p.is_test, false) = false
   and exists (
     select 1 from public.orders o
      where o.customer_id = p.id and o.status in ('delivered', 'completed')
   );
