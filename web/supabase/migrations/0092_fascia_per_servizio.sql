-- Il martedì è lavanderia, il mercoledì è stiro.
-- ==============================================
--
-- Perché
-- ------
-- Da quando le lavanderie sono due, i due lavori viaggiano in giorni diversi:
-- il martedì si ritira per la lavanderia, il mercoledì per la stireria. Finora
-- la fascia non sapeva dirlo — era solo «un ritiro» — e di conseguenza:
--
--   * il cliente vedeva tutte le fasce e poteva prenotare il mercoledì un sacco
--     da lavare, che sarebbe partito verso Arluno dove non lo lavano;
--   * in pannello e sul giro del rider le due giornate erano indistinguibili,
--     e con due destinazioni diverse è il modo più rapido per far uscire pazzo
--     chi organizza.
--
-- Qui la fascia dichiara **che lavoro è**. Da lì discendono tre cose: chi la
-- può prenotare, dove va il sacco, e come si legge in calendario.
--
-- `null` = fascia buona per tutti. Lo restano le riconsegne, perché il giro di
-- riconsegna è uno solo per scelta, e le fasce vecchie, che nessuno deve
-- ritrovarsi sparite.

alter table public.slots
  add column if not exists servizio text;

alter table public.slots
  drop constraint if exists slots_servizio_check;

alter table public.slots
  add constraint slots_servizio_check
  check (servizio is null or servizio in ('lavanderia', 'stiro'));

comment on column public.slots.servizio is
  'Che lavoro si ritira in questa fascia: lavanderia | stiro. Decide chi può prenotarla e dove va il sacco. null = per tutti (le riconsegne, e le fasce nate prima di ottobre 2026).';

create index if not exists slots_servizio_idx on public.slots (servizio) where servizio is not null;

-- Le fasce che ci sono già, intestate a quello che sono: il martedì è il giorno
-- della lavanderia da sempre, il mercoledì è nato ieri per la stireria.
update public.slots
   set servizio = 'lavanderia'
 where kind = 'pickup'
   and servizio is null
   and extract(dow from (starts_at at time zone 'Europe/Rome')) = 2;

update public.slots
   set servizio = 'stiro'
 where kind = 'pickup'
   and servizio is null
   and extract(dow from (starts_at at time zone 'Europe/Rome')) = 3;
