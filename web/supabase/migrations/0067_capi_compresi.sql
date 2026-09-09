-- Un capo compreso nell'abbonamento è una riga da zero, e deve poter esistere.
--
-- Il difetto
-- ----------
-- `qty > 0` sembrava ovvio: a che serve registrare un capo che non si
-- addebita? Serve, ed è il motivo per cui la lavanderia si è bloccata.
--
-- Con la franchigia — 3 camicie per sacco — registrando una camicia sola non
-- c'era niente da addebitare, e il codice usciva in silenzio senza scrivere
-- nulla. Due conseguenze:
--
--   1. a schermo non succedeva niente: la pagina si ricaricava identica, e da
--      lì dentro è indistinguibile da un pulsante rotto;
--   2. **la franchigia non si consumava mai**. Il conto delle già registrate
--      legge le righe esistenti: senza righe, la volta dopo riparte da zero.
--      Registrando le camicie una per volta, la settima e l'ottava risultavano
--      ancora «incluse» — si potevano lavare dieci camicie senza addebitarne
--      una.
--
-- Correggendo il codice perché scrivesse sempre la riga, il vincolo l'ha
-- rifiutata e la pagina è andata in errore 500. Il vincolo, non il codice, era
-- la cosa sbagliata.
--
-- Perché zero è un valore legittimo
-- ---------------------------------
-- `qty` non è «quanti capi ci sono», è «quanti se ne addebitano». Zero vuol
-- dire: il capo c'era, l'abbiamo trovato, e l'abbonamento lo copre. È
-- un'informazione, non un vuoto — e senza di essa il conto della franchigia non
-- si può tenere.
--
-- Le due colonne accanto raccontano il resto: `qty_totale` quante ce n'erano,
-- `qty_inclusa` quante ne ha assorbite l'abbonamento.
--
-- Chi incassa scarta le righe a zero: una voce da zero centesimi su una fattura
-- Stripe verrebbe comunque rifiutata, e il filtro è già nel codice
-- (`capiDaIncassare` in `lib/extra-selezione.ts`, con il suo test).

alter table public.order_specials drop constraint order_specials_qty_check;

alter table public.order_specials
  add constraint order_specials_qty_check check (qty >= 0);

comment on column public.order_specials.qty is
  'Quante unità si addebitano. Zero è legittimo: il capo c''era ma l''abbonamento lo copre, e la riga serve a tenere il conto della franchigia. Chi incassa scarta le righe a zero.';
