-- 0025 — Data di disdetta abbonamento (per il churn datato in dashboard).
-- Finora si salvava solo lo `status`; non si poteva sapere QUANDO un abbonamento
-- veniva disdetto. `canceled_at` viene impostato alla disdetta (admin + webhook
-- Stripe) e azzerato in caso di riattivazione.
alter table subscriptions add column if not exists canceled_at timestamptz;
