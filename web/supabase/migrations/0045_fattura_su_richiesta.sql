-- 0045 — Fattura solo a chi la chiede.
--
-- Indicazione del commercialista: ricevuta a tutti, fattura elettronica solo su
-- richiesta. Cambia parecchio rispetto all'ipotesi "fattura a ognuno":
--
--   * il codice fiscale NON va chiesto a tutti in registrazione — sarebbe un
--     dato raccolto senza motivo per la maggioranza dei clienti, e un attrito
--     in più proprio nel punto dove si perde l'iscrizione;
--   * serve invece un posto dove chi la vuole lasci i propri dati fiscali, e
--     dove noi vediamo chi l'ha chiesta.
--
-- I dati stanno sul profilo e non sulla singola fattura perché chi chiede la
-- fattura una volta la vuole anche il mese dopo: si compilano una volta sola.

alter table profiles
  add column if not exists billing_name    text,
  add column if not exists billing_address text,
  add column if not exists billing_cap     text,
  add column if not exists billing_city    text,
  add column if not exists billing_tax_code text,   -- codice fiscale (privati)
  add column if not exists billing_vat     text,    -- partita IVA (aziende)
  add column if not exists billing_sdi     text,    -- codice destinatario SDI
  add column if not exists billing_pec     text,
  -- Chi ha chiesto la fattura la riceve anche sui rinnovi successivi, senza
  -- doverla richiedere ogni mese.
  add column if not exists billing_wants_invoice boolean not null default false;

comment on column profiles.billing_wants_invoice is
  'true = a ogni incasso si emette fattura elettronica. false (default) = solo ricevuta.';
comment on column profiles.billing_tax_code is
  'Codice fiscale, obbligatorio per la fattura a un privato. Chiesto solo a chi la richiede.';

-- Quando è stata chiesta la fattura per quell'incasso. Serve a distinguere una
-- riga "non fatturata perché nessuno l'ha chiesta" da una "da fatturare".
alter table invoices
  add column if not exists requested_at timestamptz;

comment on column invoices.requested_at is
  'Momento della richiesta di fattura. Null = al cliente è bastata la ricevuta.';

-- Il default cambia: un incasso non è più "da emettere" per definizione.
-- Nel regime scelto la norma è la ricevuta, e la fattura è l'eccezione.
alter table invoices alter column stato set default 'saltata';
