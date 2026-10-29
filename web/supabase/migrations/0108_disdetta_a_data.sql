-- La disdetta «a una data», che su Stripe è un campo diverso.
--
-- Stripe ha due modi di programmare la fine di un abbonamento:
--   `cancel_at_period_end = true` — finisce quando finisce il periodo pagato;
--   `cancel_at = <istante>`       — finisce quel giorno, e basta.
--
-- Noi leggevamo **solo il primo**. Una disdetta messa a data — ed è quella che
-- scrive il portale clienti quando si sceglie «annulla il …», ed è quella che
-- si mette a mano dalla dashboard — arrivava da Stripe con
-- `cancel_at_period_end` a **falso**, e per noi quell'abbonamento era
-- semplicemente attivo.
--
-- Il 29 ottobre 2026 una cliente ha disdetto, su Stripe c'era scritto «Data di
-- annullamento 29 ott 2026», e il pannello continuava a dire «Attivo · rinnovo
-- oggi · 160,00 €». Non era la copia rimasta indietro: era la copia che
-- guardava il campo sbagliato, quindi nemmeno rileggere da Stripe la
-- correggeva. Un difetto che si ripara da sé è meglio di uno che sopravvive a
-- ogni sincronizzazione.

alter table public.subscriptions
  add column if not exists cancel_at timestamptz;

comment on column public.subscriptions.cancel_at is
  'Disdetta programmata a una data precisa (Stripe `cancel_at`). È diversa da `cancel_at_period_end`, e Stripe ne usa una sola delle due: una disdetta è programmata quando c''è l''una OPPURE l''altra. Qui null = nessuna disdetta a data.';
