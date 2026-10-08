-- 0088 — Che servizio fa quel cliente.
--
-- Non si deduce da niente di quello che abbiamo: un abbonamento Small non dice
-- se quella persona ci manda camicie da stirare o bucato da lavare. Lo sa chi
-- parla con i clienti, e lo scrive a mano dal pannello.
--
-- Serve a due cose: leggere il CRM, e decidere la lista di Brevo — «solo stiro»
-- è un cluster a sé, con le sue email.
--
-- Nullo di default, e nullo resta finché qualcuno non compila: un «lava-stira»
-- messo d'ufficio sarebbe un dato inventato, e da lì partirebbero email
-- sbagliate a gente che non ha mai chiesto quel servizio.
alter table public.profiles
  add column if not exists tipo_servizio text;

alter table public.profiles
  drop constraint if exists profiles_tipo_servizio_check;

alter table public.profiles
  add constraint profiles_tipo_servizio_check
  check (tipo_servizio is null or tipo_servizio in ('lava_stira','solo_stiro','solo_lavanderia'));

comment on column public.profiles.tipo_servizio is
  'Servizio concordato col cliente: lava_stira | solo_stiro | solo_lavanderia. Si compila a mano dal pannello; null = non ancora deciso. Decide anche la lista Brevo «Solo Stiro».';
