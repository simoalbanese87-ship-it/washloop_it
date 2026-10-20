-- Che movimento è: un ricavo, un aggiustamento di canone, o lo storno di un capo.
-- ==============================================================================
--
-- Perché
-- ------
-- Federica è passata al solo stiro il 13 ottobre: 110,00 € resi sulla ricevuta
-- del canone vecchio e 72,00 € di conguaglio per quello nuovo. Netto incassato
-- 122,00 €, cioè esattamente il canone del mese.
--
-- In Competenza quei due movimenti venivano letti come due cose che non sono:
-- il conguaglio come un ricavo in più — sopra il canone che la pagina già
-- spalma per settimana — e il rimborso come niente, perché le righe `refund`
-- sono escluse di proposito nella convinzione che siano tutte storni di capi.
-- Risultato: 102,50 € di ricavi su una cliente che in quel mese vale 91,50 €.
--
-- Tre valori e non un sì/no
-- -------------------------
-- La domanda vera non è «è canone?» ma «di che movimento si tratta», e un
-- booleano negativo (`non_e_ricavo`) invecchia male: al terzo caso nessuno sa
-- più cosa ci sta dentro.
--
--   * `servizio` — un ricavo vero: un addebito a mano, una lavorazione fuori
--     listino, un sacco. È il default perché le righe scritte finora sono
--     quasi tutte queste.
--   * `canone`  — rimborso o conguaglio che **sposta il canone**. Quei soldi la
--     competenza li conta già come quota settimanale: contarli di nuovo vuol
--     dire contare lo stesso mese una volta e mezzo.
--   * `capo`    — la riga gemella di un capo speciale (storno o annullamento).
--     Non è un movimento a sé: il capo è già fuori dal conto perché i capi si
--     leggono da `order_specials`. Oggi questo si deduce dal riferimento
--     Stripe; qui diventa un dato scritto.

alter table public.customer_charges
  add column if not exists categoria text not null default 'servizio';

alter table public.customer_charges
  drop constraint if exists customer_charges_categoria_valida;
alter table public.customer_charges
  add constraint customer_charges_categoria_valida
  check (categoria in ('servizio', 'canone', 'capo'));

comment on column public.customer_charges.categoria is
  'servizio = ricavo vero; canone = aggiustamento del canone, già contato dalla quota settimanale; capo = gemella di un capo speciale, già fuori dal conto.';

-- Le due righe del cambio piano di Federica, riconosciute per data, importo e
-- testo: tre condizioni insieme, perché una `ilike` generosa un giorno
-- prenderebbe un addebito vero.
update public.customer_charges
   set categoria = 'canone'
 where created_at >= '2026-10-13' and created_at < '2026-10-14'
   and status <> 'void'
   and (   (kind = 'refund' and amount_cents = 11000 and description ilike '%passaggio a solo stiro%')
        or (kind = 'charge' and amount_cents = 7200  and description ilike '%conguaglio passaggio a solo stiro%'));

-- Gli altri due rimborsi di canone trovati in archivio, del 12 ottobre: quattro
-- euro di «giorni non usati dopo la disdetta» e otto di «ritiro annullato»,
-- entrambi sulla ricevuta n. 8. Sono canone restituito, non capi: oggi erano
-- già fuori dai conti perché `refund`, ma la colonna deve dire il vero anche
-- dove non cambia un numero.
update public.customer_charges
   set categoria = 'canone'
 where kind = 'refund' and status <> 'void'
   and created_at >= '2026-10-12' and created_at < '2026-10-13'
   and description ilike 'Rimborso ricevuta n. 8 ·%';

-- Le gemelle dei capi rimborsati: si riconoscono dal riferimento Stripe che
-- `order_specials` ha già in `refund_ref`. Nessun numero cambia — quelle righe
-- erano già fuori da ogni conto — ma una colonna che mente su metà tabella è
-- peggio di una colonna che non c'è.
update public.customer_charges cc
   set categoria = 'capo'
 where cc.kind = 'refund' and cc.stripe_ref is not null
   and exists (select 1 from public.order_specials os where os.refund_ref = cc.stripe_ref);

-- Gli annullamenti di un capo non muovono soldi e non hanno riferimento: l'unico
-- appiglio è la descrizione, che la scrive il codice ed è letterale.
update public.customer_charges
   set categoria = 'capo'
 where kind = 'refund' and stripe_ref is null
   and description like 'Addebito annullato: %';
