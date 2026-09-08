-- Due cose che il database non sapeva dire, e che perciò nessuna pagina poteva
-- mostrare senza inventarsele.
--
-- 1. La disdetta a fine periodo
-- -----------------------------
-- Premendo «Disdici» succedevano due cose diverse nei due posti:
--
--   su Stripe   -> cancel_at_period_end = true   (resta attivo fino al rinnovo)
--   da noi      -> status = 'canceled'           (disdetto, subito)
--
-- Poi arrivava il webhook `customer.subscription.updated`, che riporta lo stato
-- **di Stripe** — cioè `active`, perché fino al rinnovo lo è — e `syncSubscription`
-- lo riscriveva sopra il nostro, azzerando pure `canceled_at`.
--
-- Risultato: la disdetta si annullava da sola dopo pochi secondi, il bottone
-- «Disdici» ricompariva e chi l'aveva premuto concludeva che non avesse
-- funzionato. Non era un problema di sincronia: era che «disdetto a fine
-- periodo» non esisteva come stato, quindi andava schiacciato o su «attivo» o
-- su «disdetto», e nessuno dei due è vero.
--
-- Ora esiste. È esattamente il dato che Stripe ha sempre avuto e che noi
-- buttavamo via a ogni webhook.

alter table public.subscriptions
  add column cancel_at_period_end boolean not null default false;

comment on column public.subscriptions.cancel_at_period_end is
  'L''abbonamento è ancora attivo ma non si rinnoverà: finisce a current_period_end. Viene da Stripe e va tenuto, altrimenti «disdetto a fine periodo» si perde a ogni sincronizzazione.';

-- Le disdette già in essere: chi su Stripe risulta attivo ma con la disdetta
-- programmata deve ritrovarsi allineato senza aspettare il prossimo webhook.
-- Qui non possiamo interrogare Stripe, quindi si parte da chi ha una data di
-- disdetta registrata pur restando attivo: è esattamente quel caso.
update public.subscriptions
   set cancel_at_period_end = true
 where status in ('active', 'trialing') and canceled_at is not null;

-- 2. Quando la lavanderia è stata pagata
-- --------------------------------------
-- `laundry_payouts.status` diceva 'pending' o 'settled', ma non **quando** era
-- diventato settled. Per noi bastava; per chi aspetta il bonifico no: «pagato»
-- senza una data è una parola, e chi deve controllare il proprio compenso non
-- ha niente da confrontare con l'estratto conto.

alter table public.laundry_payouts
  add column paid_at timestamptz;

comment on column public.laundry_payouts.paid_at is
  'Quando questa riga è stata segnata come pagata. Serve alla lavanderia per riconciliare con il bonifico: «pagato» senza data non si verifica.';

-- Le righe già liquidate prima di oggi non hanno una data vera e inventarla
-- sarebbe peggio che non averla: restano senza, e la pagina lo dice.
