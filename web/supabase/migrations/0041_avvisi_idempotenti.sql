-- 0041 — Segna quando un avviso è già partito, così non parte due volte.
--
-- Due avvisi nuovi non sono legati a un cambio di stato e quindi non hanno un
-- momento unico in cui scattare: il promemoria della sera prima lo decide un
-- cron, l'email di benvenuto la fa partire il browser dopo la registrazione.
-- Entrambi sono rieseguibili — un cron lanciato a mano, un utente che ricarica
-- la pagina — e senza un segno in tabella il cliente riceverebbe la stessa
-- email due volte. Il segno sta in DB e non in memoria perché le funzioni
-- serverless non condividono stato tra invocazioni.

alter table orders
  add column if not exists pickup_reminder_at timestamptz,
  add column if not exists delivery_reminder_at timestamptz;

comment on column orders.pickup_reminder_at is
  'Quando è partito il promemoria "domani ritiriamo". Null = mai inviato.';
comment on column orders.delivery_reminder_at is
  'Quando è partito il promemoria "domani riconsegniamo". Null = mai inviato.';

alter table profiles
  add column if not exists welcome_sent_at timestamptz;

comment on column profiles.welcome_sent_at is
  'Quando è partita l''email di benvenuto. Null = mai inviata.';

-- Il cron cerca gli ordini con slot di domani e promemoria non ancora inviato:
-- senza indice è un seq scan su tutti gli ordini, ogni sera.
create index if not exists orders_pickup_reminder_idx
  on orders (pickup_slot_id) where pickup_reminder_at is null;
create index if not exists orders_delivery_reminder_idx
  on orders (delivery_slot_id) where delivery_reminder_at is null;
