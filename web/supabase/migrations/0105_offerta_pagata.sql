-- Una proposta pagata deve smettere di dire «in attesa di pagamento».
--
-- Perché
-- ------
-- `subscription_offers` registrava la proposta e non sapeva niente del suo
-- esito. Per un link di abbonamento l'esito si deduceva dalla subscription che
-- nasceva; per un link **una tantum** non nasce niente, quindi la proposta
-- restava aperta per sempre. Il 22 ottobre una cliente ha pagato 30,50 € alle
-- 08:35 e la sua scheda continuava a mostrare «In attesa di pagamento» con il
-- link di Stripe ancora vivo e valido fino al giorno dopo.
--
-- Non è un difetto di forma: quel link è una cassa aperta. Chi guarda la scheda
-- lo rimanda, oppure la cliente riapre la mail, e paga una seconda volta.
--
-- Si scrive l'esito invece di dedurlo: `pagato_at` e il riferimento del
-- movimento su Stripe, messi dal webhook nel momento in cui i soldi arrivano.

alter table public.subscription_offers
  add column if not exists pagato_at timestamptz,
  add column if not exists pagamento_ref text;

comment on column public.subscription_offers.pagato_at is
  'Quando il cliente ha pagato questo link, scritto dal webhook su checkout.session.completed. Finché è null la proposta è ancora aperta e il link va mostrato; appena è valorizzato il link non si mostra più, o si incassa due volte.';

-- Le proposte già pagate. Si segnano una per una, non con una regola: le altre
-- due di questa cliente sono scadute senza essere pagate, e una `update`
-- generosa le marcherebbe come incassate.
update public.subscription_offers
   set pagato_at = '2026-10-22 06:35:57.813805+00', pagamento_ref = 'pi_3UTFRnLZ0ecdcujg3M50Ni8T'
 where checkout_session_id = 'cs_live_a1X3bxaBdnXOnZCeGFKAKTV1FLNeD5pZS4GjKFm6xKAVMSwOOMeYFXmJpc';
