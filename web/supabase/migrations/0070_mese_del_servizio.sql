-- Il compenso si raggruppa per il mese in cui il servizio è stato fatto.
--
-- Il difetto
-- ----------
-- «Soldi alla lavanderia» raggruppava per `created_at` della riga di compenso,
-- cioè per **quando l'abbiamo scritta noi**. Non è la stessa cosa del mese in
-- cui il lavoro è stato fatto, e le due date si separano con facilità:
--
--   * la riga dei sacchi si scrive alla riconsegna, quella dei capi speciali
--     quando la lavanderia li registra — di solito qualche giorno prima. Un
--     ritiro a cavallo di fine mese finisce **spezzato su due mesi**: i capi in
--     settembre, i sacchi in ottobre;
--   * una correzione fatta oggi su un ordine di agosto sposta quella riga nel
--     mese sbagliato.
--
-- Con un fornitore che emette un proforma al mese, un totale che non
-- corrisponde a nessun mese di lavoro non si può controllare — e il bottone
-- «Segna pagato» liquidava per la stessa data, quindi sbagliava insieme alla
-- pagina.
--
-- Cosa cambia
-- -----------
-- `servizio_il` è il giorno a cui il compenso si riferisce: la **riconsegna**,
-- cioè quando il lavoro è finito. Tutte le righe di un ordine ne portano lo
-- stesso, quindi un ordine non si spezza più fra due mesi, e la data non si
-- muove se domani correggiamo un importo.
--
-- Non è ricavabile al volo dalla riga: `order_id` è nullo sulle voci senza
-- ordine, e gli slot possono essere archiviati. Si scrive una volta, quando il
-- compenso nasce.

alter table public.laundry_payouts add column servizio_il date;

comment on column public.laundry_payouts.servizio_il is
  'Giorno del servizio a cui il compenso si riferisce (riconsegna; in mancanza il ritiro). È la data con cui si raggruppa il dovuto per mese e con cui si liquida: `created_at` dice quando abbiamo scritto la riga, che è un''altra domanda.';

-- Le righe esistenti: riconsegna, altrimenti ritiro, altrimenti il giorno in
-- cui la riga è stata scritta.
update public.laundry_payouts lp
   set servizio_il = coalesce(
     (select sd.starts_at::date
        from public.orders o
        join public.slots sd on sd.id = o.delivery_slot_id
       where o.id = lp.order_id),
     (select sp.starts_at::date
        from public.orders o
        join public.slots sp on sp.id = o.pickup_slot_id
       where o.id = lp.order_id),
     lp.created_at::date)
 where servizio_il is null;

-- Da qui in poi non si scrive più una riga senza dire a quale servizio
-- appartiene: un compenso senza periodo è esattamente il buco da cui si esce.
alter table public.laundry_payouts alter column servizio_il set not null;
