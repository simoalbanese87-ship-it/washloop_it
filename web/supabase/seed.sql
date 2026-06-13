-- Seed iniziale WashLoop — piani e zone Milano di partenza.
-- stripe_price_id va riempito dopo aver creato i prezzi su Stripe.

insert into plans (code, name, price_month_cents, pickups_per_week, sort) values
  ('essential', 'Essential', 5900, 1, 1),
  ('plus',      'Plus',      9900, 2, 2),
  ('family',    'Family',   15900, 3, 3)
on conflict (code) do nothing;

insert into zones (name, city) values
  ('Centro', 'Milano'),
  ('Brera', 'Milano'),
  ('Porta Romana', 'Milano'),
  ('Navigli', 'Milano'),
  ('Isola', 'Milano'),
  ('Città Studi', 'Milano'),
  ('Porta Venezia', 'Milano'),
  ('Sempione', 'Milano')
on conflict do nothing;
