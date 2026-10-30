-- I ritiri comprati non scadono, e si chiamano ritiri.
-- =====================================================
--
-- Due correzioni allo stesso oggetto, arrivate insieme.
--
-- 1. Il nome
-- ----------
-- «Non chiamarlo gettone, chiamalo ritiro»: è quello che il cliente compra e
-- quello che il cliente riceve, e due parole per la stessa cosa diventano due
-- idee diverse nella testa di chi legge il codice sei mesi dopo. La tabella è
-- nata stamattina e non la legge ancora nessuno: si rinomina adesso, che è
-- l'unico momento in cui costa zero.
--
-- 2. La scadenza che non doveva esserci
-- -------------------------------------
-- `passaggi_per_ciclo` (migrazione 0096) contava dentro il periodo pagato, e
-- quello che avanzava scadeva col ciclo. Sembrava giusto finché era solo un
-- numero da dire al telefono; da quando **ferma** chi prenota è un'altra cosa:
-- una cliente che ha pagato 71,00 € si sentiva dire «da usare entro il 14/11».
--
-- Ma lei non ha comprato un mese: ha comprato due ritiri al mese, dal link
-- personalizzato. Un ritiro comprato e non usato non è un diritto scaduto, è un
-- lavoro che le dobbiamo ancora. «Perché deve avere un tempo limite?» — non
-- deve.
--
-- Quindi il tetto del ciclo sparisce e al suo posto c'è un rubinetto: ogni
-- rinnovo accredita N ritiri, che si sommano a quelli che aveva e non scadono
-- mai. «Un ritiro = una settimana» resta il modo normale di raccontarlo, non
-- una regola che il programma fa rispettare.
--
-- `passaggi_per_ciclo` e `passaggi_riportati` restano in tabella: sono il
-- registro di com'era, e cancellarli vorrebbe dire perdere il perché dei numeri
-- di ottobre. Non li legge più nessuno.

alter table public.gettoni rename to ritiri_comprati;
alter index if exists gettoni_customer_idx rename to ritiri_comprati_customer_idx;

comment on table public.ritiri_comprati is
  'Ritiri comprati: ogni riga è un accredito (un acquisto, un rinnovo, un regalo). Il consumo è l''ordine con ritiro_pagato_at valorizzato, e il saldo è la differenza fra i due. Non scadono.';

alter table public.ritiri_comprati rename column quanti to quanti_ritiri;

drop policy if exists "gettoni owner read" on public.ritiri_comprati;
drop policy if exists "gettoni admin write" on public.ritiri_comprati;

create policy "ritiri comprati owner read" on public.ritiri_comprati
  for select using (customer_id = auth.uid() or public.is_admin());

create policy "ritiri comprati admin write" on public.ritiri_comprati
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.orders rename column gettone_at to ritiro_pagato_at;

comment on column public.orders.ritiro_pagato_at is
  'Quando questo ordine ha consumato un ritiro comprato. null = pagato in un altro modo (abbonamento a canone, a consumo, o prima che i ritiri comprati esistessero). Un ordine annullato non conta: il ritiro torna disponibile da solo.';

alter table public.subscription_offers rename column gettoni to ritiri;

alter table public.subscription_offers
  drop constraint if exists subscription_offers_gettoni_positivi;

alter table public.subscription_offers
  drop constraint if exists subscription_offers_ritiri_positivi;

alter table public.subscription_offers
  add constraint subscription_offers_ritiri_positivi
  check (ritiri is null or ritiri > 0);

comment on column public.subscription_offers.ritiri is
  'Quanti ritiri accredita questa proposta quando viene pagata. null = non è una vendita di ritiri.';

-- Il rubinetto mensile: quanti ritiri accredita ogni rinnovo.
alter table public.subscriptions
  add column if not exists ritiri_per_rinnovo int;

alter table public.subscriptions
  drop constraint if exists subscriptions_ritiri_per_rinnovo_positivi;

alter table public.subscriptions
  add constraint subscriptions_ritiri_per_rinnovo_positivi
  check (ritiri_per_rinnovo is null or ritiri_per_rinnovo > 0);

comment on column public.subscriptions.ritiri_per_rinnovo is
  'Quanti ritiri accredita ogni rinnovo pagato. I ritiri si sommano a quelli che il cliente ha già e non scadono: è il contrario di passaggi_per_ciclo, che era un tetto dentro il periodo. null = abbonamento senza numero di ritiri, cioè la cadenza la dà il calendario (il caso di tutti gli abbonamenti storici).';

comment on column public.subscriptions.passaggi_per_ciclo is
  'SUPERATA dalla 0111: era il tetto di ritiri dentro il periodo pagato, e quello che avanzava scadeva col ciclo. Resta come registro di com''era; il diritto adesso si conta in ritiri_per_rinnovo e in ritiri_comprati.';

-- Chi aveva un tetto adesso ha un rubinetto, con lo stesso numero.
update public.subscriptions
   set ritiri_per_rinnovo = passaggi_per_ciclo
 where passaggi_per_ciclo is not null
   and ritiri_per_rinnovo is null;
