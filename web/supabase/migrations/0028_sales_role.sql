-- 0028_sales_role.sql
-- Aggiunge il ruolo 'sales' (team commerciale: vede la dashboard lead, non i dati
-- operativi). ADD VALUE è idempotente con IF NOT EXISTS.
alter type user_role add value if not exists 'sales';
