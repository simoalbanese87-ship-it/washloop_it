-- Se il capo lo regaliamo noi, la lavanderia va pagata lo stesso.
--
-- Il difetto
-- ----------
-- Annullando o rimborsando un capo al cliente, il compenso alla lavanderia
-- veniva sempre azzerato (`laundry_payouts.status = 'void'`). Giusto in un
-- caso, sbagliato nell'altro, e i due casi non si distinguevano:
--
--   * **errore della lavanderia** — hanno contato male, il capo non c'era, o
--     l'hanno rovinato. Non si paga: il lavoro non è stato fatto, o è stato
--     fatto male;
--   * **gesto commerciale nostro** — il capo l'hanno lavato davvero e noi
--     decidiamo di non farlo pagare al cliente. Qui la lavanderia ha lavorato,
--     e il regalo lo facciamo noi, non loro.
--
-- Nel tabellone dei compensi si vedono tre righe a 0,00 € — 6× Camicia e 3×
-- Camicia di Giulia, 1× Camicia di fabia — su capi che sono stati lavati.
-- Azzerare il compenso senza chiederselo significa far pagare alla lavanderia
-- una decisione nostra.
--
-- Cosa cambia
-- -----------
-- Al momento dello storno si sceglie, e la scelta resta scritta: `a_carico_di`
-- dice chi se lo prende. Non è un dettaglio contabile — è la differenza fra
-- «non ti devo niente» e «ti pago anche se al cliente non l'ho fatto pagare»,
-- ed è la cosa che la lavanderia chiederà guardando il proforma.

alter table public.order_specials
  add column regalato boolean not null default false,
  add column regalato_motivo text;

comment on column public.order_specials.regalato is
  'Il capo è stato tolto al cliente ma la lavanderia lo ha lavorato: il compenso resta dovuto. Distingue il gesto commerciale dall''errore della lavanderia.';

-- Le righe di compenso azzerate per un capo regalato tornano dovute. Oggi non
-- ce ne sono — la colonna nasce adesso — ma la regola va scritta qui, perché
-- è dove si spiega perché una riga `void` possa tornare `pending`.
comment on column public.laundry_payouts.status is
  'pending = da pagare, settled = pagata, void = non dovuta. Un capo stornato al cliente ma marcato «regalato» resta pending: il lavoro è stato fatto.';
