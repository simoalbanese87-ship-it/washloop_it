-- Tenere un cliente fuori dal conto di Competenza, dicendo perché.
-- =================================================================
--
-- Perché
-- ------
-- Da oggi il canone matura in tutte le settimane coperte dall'abbonamento, e
-- questo ha fatto comparire 25,00 € di ricavi su Emanuela Dini: abbonamento
-- **manuale**, segnato attivo dal pannello il 12 ottobre, disdetto il 20, e
-- **mai un euro incassato** — in `invoices` non ha nemmeno una riga.
--
-- La causa l'abbiamo chiusa dove stava (`copertura-canone.ts`: un abbonamento
-- manuale senza nessun incasso registrato non copre niente). Ma la regola, per
-- quanto la si scriva bene, non prenderà il prossimo caso: un cliente da
-- stralciare, un accordo saltato, una prova che non andava contata. E ogni
-- volta servirebbe toccare il codice.
--
-- Così invece lo decide chi guarda i numeri, da solo, in pannello.
--
-- Perché con un motivo obbligatorio
-- ---------------------------------
-- Un cliente che sparisce da un conto senza una ragione scritta, sei mesi
-- dopo, è un numero che non si sa più difendere. Il motivo si scrive adesso,
-- che è l'unico momento in cui qualcuno lo sa. E l'esclusione resta **visibile
-- in fondo alla pagina**, non cancellata: un cliente tolto di nascosto è un
-- buco; un cliente tolto e scritto è una decisione.
--
-- Si rimette con un clic: nessun dato viene distrutto, i calcoli restano
-- quelli e si tolgono solo dalla somma.

alter table public.profiles
  add column if not exists competenza_escluso_at timestamptz,
  add column if not exists competenza_escluso_motivo text,
  add column if not exists competenza_escluso_da uuid references public.profiles(id) on delete set null;

comment on column public.profiles.competenza_escluso_at is
  'Quando è stato tolto dal conto di Competenza. Null = conta normalmente.';
comment on column public.profiles.competenza_escluso_motivo is
  'Perché è stato tolto. Obbligatorio: un cliente che sparisce da un conto senza una ragione scritta non si sa più difendere.';

-- Il trigger della 0037 protegge ruolo, lavanderia e codice cliente: queste
-- colonne non lo riguardano e restano scrivibili solo dal server, che passa
-- dal service role.
