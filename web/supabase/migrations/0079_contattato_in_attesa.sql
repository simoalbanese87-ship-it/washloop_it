-- «L'ho chiamato e aspetto che risponda».
--
-- Perché
-- ------
-- Gli stati erano cinque e non c'era posto per il caso più comune del lavoro di
-- tutti i giorni: la persona è stata contattata e la palla è dalla sua parte.
-- Finiva in «Contatto in corso» insieme a chi è in trattativa vera, e le due
-- cose chiedono azioni diverse — una si aspetta, l'altra si porta avanti.
--
-- Il CHECK anche su profiles
-- --------------------------
-- `leads.contact_status` il vincolo ce l'ha dal 0036. `profiles.contact_status`
-- no: il 0047 lo ha aggiunto con un commento che dice «stesso vocabolario di
-- leads» e nient'altro. Un commento non ferma una scrittura: lì dentro può
-- finire qualunque stringa, e il giorno che succede i filtri di Persone
-- smettono di trovare quella riga senza dare errore. Se il vocabolario è lo
-- stesso, lo deve dire il database in entrambe le tabelle.

alter table public.leads drop constraint if exists leads_contact_status_check;
alter table public.leads add constraint leads_contact_status_check
  check (contact_status in ('da_contattare','non_esiste','non_interessato','in_corso','in_attesa','convertito'));

-- Prima di vincolare `profiles`, si sana quello che c'è: la colonna è nata
-- senza regole, quindi non si può dare per scontato che contenga solo valori
-- dell'elenco. Quello che non riconosciamo torna al punto di partenza.
update public.profiles
   set contact_status = null
 where contact_status is not null
   and contact_status not in ('da_contattare','non_esiste','non_interessato','in_corso','in_attesa','convertito');

alter table public.profiles drop constraint if exists profiles_contact_status_check;
alter table public.profiles add constraint profiles_contact_status_check
  check (contact_status is null or contact_status in ('da_contattare','non_esiste','non_interessato','in_corso','in_attesa','convertito'));

comment on column public.profiles.contact_status is
  'Stesso vocabolario di leads.contact_status, e da ora lo dice anche il vincolo: in Persone lead e clienti stanno nella stessa lista e vanno lavorati allo stesso modo. null = mai impostato, che in elenco si legge «Da contattare».';
