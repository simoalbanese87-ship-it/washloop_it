-- Un incasso restituito non è un incasso.
--
-- Perché
-- ------
-- Il registro degli incassi mostrava «14 incassi» e ne sommava il totale, ma
-- due di quelle righe erano soldi già tornati indietro al cliente: la n. 7 da
-- 10,50 € e la n. 14 da 3,50 €, rimborsi Stripe veri (`re_3UDho…`, `re_3UJYZ…`).
-- Non era un errore della pagina: **il rimborso non esisteva proprio** in
-- questa tabella, e non c'era modo di distinguerlo.
--
-- Perché non bastava filtrare
-- ---------------------------
-- Il webhook non ascoltava `charge.refunded`, e l'import da Stripe chiede le
-- fatture con `status: 'paid'` sommando `amount_paid`, che dopo un rimborso non
-- cala di un centesimo. Da qualunque parte si guardasse, una ricevuta
-- rimborsata era identica a una buona.
--
-- Perché una cifra e non un sì/no
-- -------------------------------
-- Un rimborso può essere parziale. Con un booleano, il giorno che se ne
-- restituisce metà bisognerebbe scegliere fra buttare via l'intera ricevuta o
-- tenerla per intera, e sarebbero sbagliate entrambe.

alter table public.invoices
  add column if not exists rimborsato_at timestamptz,
  add column if not exists rimborsato_cents int;

comment on column public.invoices.rimborsato_at is
  'Quando il denaro è tornato al cliente. Lo scrive il webhook `charge.refunded`. Una ricevuta con questa data non è un incasso e non entra nei totali.';

comment on column public.invoices.rimborsato_cents is
  'Quanto è stato restituito, in centesimi. Può essere meno dell''importo della ricevuta: i rimborsi parziali esistono.';

create index if not exists invoices_rimborsato_idx
  on public.invoices (rimborsato_at) where rimborsato_at is not null;

-- Backfill di quello che è già successo.
--
-- Il legame è `order_specials.stripe_invoice_id`: il capo sa su quale fattura è
-- finito, e `refunded_at`/`refund_ref` dicono se è tornato indietro. Da qui in
-- avanti ci penserà il webhook, ma senza questo le due ricevute già rimborsate
-- resterebbero contate per sempre.
update public.invoices i
   set rimborsato_at = sub.quando,
       rimborsato_cents = sub.cents
  from (
    select os.stripe_invoice_id,
           max(os.refunded_at) as quando,
           sum(os.price_cli_cents * os.qty) as cents
      from public.order_specials os
     where os.refunded_at is not null
       and os.stripe_invoice_id is not null
     group by os.stripe_invoice_id
  ) as sub
 where i.stripe_invoice_id = sub.stripe_invoice_id
   and i.rimborsato_at is null;
