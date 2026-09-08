-- «Addebitato» e «incassato» sono due cose diverse, e finora erano la stessa
-- colonna.
--
-- Il difetto, misurato
-- --------------------
-- `charged_at` voleva dire «ho creato la voce su Stripe». Nient'altro. Da lì i
-- soldi si muovevano soltanto quando arrivava la fattura di rinnovo
-- dell'abbonamento — cioè mai, se il cliente disdiceva prima.
--
-- Nei fatti: dall'inizio dell'attività gli extra realmente incassati sono
-- **uno**, la giacca di Saverio il 4 settembre. Le tre camicie di Giulia hanno
-- `charged_at` dal 1° settembre e zero euro incassati, in attesa di un rinnovo
-- che potrebbe non arrivare. E finché `charged_at` è valorizzato la riga
-- risulta «fatta»: non compare fra le cose da incassare, e nessuno la guarda
-- più. È lo stato peggiore di tutti, perché è silenzioso.
--
-- Cosa cambia
-- -----------
-- Da adesso l'incasso parte quando la lavanderia segna il sacco pronto, e serve
-- distinguere tre momenti che prima stavano in uno:
--
--   charged_at          l'ho chiesto a Stripe
--   incassato_at        i soldi sono arrivati        <- lo scrive il webhook
--   incasso_fallito_at  il prelievo è stato rifiutato
--
-- `incassato_at` non lo scrive chi preme il bottone, ma il webhook
-- `invoice.payment_succeeded`: è l'unico punto in cui Stripe conferma che i
-- soldi si sono mossi davvero. È la stessa regola che rende affidabile la
-- tabella `invoices`, ed è esattamente la confusione da cui usciamo.

alter table public.order_specials
  -- La fattura su cui è finito: serve a risalire, e a riprovare il prelievo
  -- senza rifare tutto da capo.
  add column stripe_invoice_id text,
  add column incassato_at timestamptz,
  add column incasso_fallito_at timestamptz,
  add column incasso_errore text,
  -- Il link di pagamento della fattura rimasta aperta. Si salva perché è la
  -- cosa che si manda al cliente, e andarlo a ripescare su Stripe ogni volta
  -- vuol dire non mandarlo.
  add column link_pagamento text;

comment on column public.order_specials.incassato_at is
  'Quando i soldi sono arrivati davvero, scritto dal webhook invoice.payment_succeeded. charged_at dice soltanto che l''addebito è stato chiesto.';
comment on column public.order_specials.incasso_fallito_at is
  'Quando il prelievo immediato è stato rifiutato. La fattura resta aperta: l''importo non è perso, va mandato il link al cliente.';

-- Incassato e fallito insieme non vuol dire niente: o i soldi sono arrivati, o
-- il prelievo è stato rifiutato.
alter table public.order_specials
  add constraint order_specials_incasso_coerente
  check (incassato_at is null or incasso_fallito_at is null);

-- Un incasso senza la sua fattura non si può verificare né riconciliare.
alter table public.order_specials
  add constraint order_specials_incasso_con_fattura
  check (incassato_at is null or stripe_invoice_id is not null);

-- La giacca di Saverio è stata davvero incassata il 4 settembre, dentro la
-- fattura da 66,30 €: quella riga la conosciamo e va scritta, altrimenti il
-- registro nuovo nascerebbe dicendo che non abbiamo mai incassato niente.
update public.order_specials os
   set stripe_invoice_id = 'in_1UBHtPLZ0ecdcujglU2PXVwp',
       incassato_at = '2026-09-04 17:24:00+00'
 where os.item_name = 'Giacca'
   and os.charged_at is not null
   and os.refunded_at is null
   and os.annullato_at is null;
