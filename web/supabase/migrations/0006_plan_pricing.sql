-- 0006 — Nuovo listino abbonamenti (giu 2026)
-- Rinomina i piani in Small/Medium/Large e aggiorna i prezzi mensili.
-- I `code` interni restano invariati (essential/plus/family) per non
-- rompere stripe_price_id e gli abbonamenti esistenti.
-- Modello: ritiro sempre 1 volta a settimana; la differenza tra i piani
-- è il numero di sacchi/settimana (1 / 2 / 3).

-- I nuovi prezzi Stripe (TEST) sono ricreati a parte; qui aggiorniamo anche
-- stripe_price_id ai prezzi attivi correnti.
update plans set name = 'Small',  price_month_cents = 16000, pickups_per_week = 1, stripe_price_id = 'price_1TjM3PLTX3lzfl9RTnMGH2HM' where code = 'essential';
update plans set name = 'Medium', price_month_cents = 28000, pickups_per_week = 1, stripe_price_id = 'price_1TjM3QLTX3lzfl9RfoZPK8KK' where code = 'plus';
update plans set name = 'Large',  price_month_cents = 39000, pickups_per_week = 1, stripe_price_id = 'price_1TjM3RLTX3lzfl9RYYfQMzCO' where code = 'family';
