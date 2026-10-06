-- 0019 — Rimborso del singolo capo speciale.
alter table order_specials add column if not exists refunded_at timestamptz;
alter table order_specials add column if not exists refund_ref text; -- id refund/credit note Stripe
