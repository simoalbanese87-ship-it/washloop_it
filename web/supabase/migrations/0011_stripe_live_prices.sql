-- ============================================================
-- 0011 — Price ID Stripe LIVE
-- Allinea plans.stripe_price_id ai prezzi creati in produzione (live mode).
-- I 3 prodotti/prezzi live (Small/Medium/Large, mensili EUR) corrispondono
-- agli importi di 0006 (160/280/390 €). I `code` interni restano invariati.
-- ============================================================
update plans set stripe_price_id = 'price_1TkNVdLZ0ecdcujglvAff4mU' where code = 'essential'; -- Small  160€
update plans set stripe_price_id = 'price_1TkNVeLZ0ecdcujgoC1ZdEYB' where code = 'plus';      -- Medium 280€
update plans set stripe_price_id = 'price_1TkNVfLZ0ecdcujgl4GIecA5' where code = 'family';    -- Large  390€
