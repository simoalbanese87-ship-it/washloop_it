-- 0047 — Recupero dei pagamenti falliti, e stato contatto per chiunque.
--
-- Prima parte: quando Stripe segnalava `invoice.payment_failed` partiva una
-- sola email e finiva lì. Nessuna traccia in banca dati, quindi nessun modo di
-- sapere se il sollecito era già partito, quando, e a che punto era il
-- recupero: né per un secondo invio, né per il pannello. Il link nell'email
-- portava alla pagina abbonamento, che per un cliente `past_due` mostra la
-- lista dei piani come se fosse un nuovo iscritto — senza mai offrirgli di
-- pagare la fattura rimasta aperta. Qui si tiene da parte l'URL di quella
-- fattura, che paga in un tap, e il contatore dei solleciti.
--
-- Seconda parte: `contact_status` esisteva solo sui lead. Dal momento in cui
-- "Registrato" viene fuso dentro "Lead", metà delle persone in lista sono
-- profili con un account: senza questa colonna lo stato contatto funzionerebbe
-- su una riga sì e una no.

alter table subscriptions
  add column if not exists dunning_step int not null default 0,
  add column if not exists dunning_last_sent_at timestamptz,
  add column if not exists last_failed_invoice_url text,
  add column if not exists last_failed_at timestamptz;

comment on column subscriptions.dunning_step is
  'Solleciti di pagamento già inviati: 0 = nessuno (tutto a posto), 1 = al momento del fallimento, 2 = dopo 3 giorni, 3 = dopo 7 giorni. Oltre il 3 non si insiste.';
comment on column subscriptions.dunning_last_sent_at is
  'Quando è partito l''ultimo sollecito. Il cron confronta questa data, non `last_failed_at`, per non rispedire due volte lo stesso giorno.';
comment on column subscriptions.last_failed_invoice_url is
  'hosted_invoice_url della fattura rimasta impagata: è il link che paga in un tap, e va nell''email e nel banner in app.';
comment on column subscriptions.last_failed_at is
  'Primo fallimento della serie in corso. Azzerato insieme al resto appena un pagamento riesce.';

-- Il cron gira ogni mattina su tutti gli abbonamenti: senza indice fa un seq
-- scan della tabella per trovarne una manciata in difficoltà.
create index if not exists subscriptions_dunning_idx
  on subscriptions (dunning_step, dunning_last_sent_at)
  where dunning_step > 0;

alter table profiles
  add column if not exists contact_status text;

comment on column profiles.contact_status is
  'Stesso vocabolario di leads.contact_status (da_contattare, non_esiste, non_interessato, in_corso, convertito): in Persone lead e clienti stanno nella stessa lista e vanno lavorati allo stesso modo.';
