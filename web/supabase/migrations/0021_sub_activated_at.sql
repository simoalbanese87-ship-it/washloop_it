-- Data di attivazione dell'abbonamento (prima transizione a stato pagato/attivo).
-- Nullable: valorizzata quando l'abbonamento diventa active/trialing (manuale o Stripe).
alter table subscriptions add column if not exists activated_at timestamptz;
