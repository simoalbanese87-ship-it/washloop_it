-- 0012 — Sacchi a settimana per piano (differenziatore dei piani)
-- Ritiro 1 volta/sett per tutti; cambia il numero di sacchi: Small 1, Medium 2, Large 3.
alter table plans add column if not exists bags_per_week int not null default 1;
update plans set bags_per_week = 1 where code = 'essential';
update plans set bags_per_week = 2 where code = 'plus';
update plans set bags_per_week = 3 where code = 'family';
