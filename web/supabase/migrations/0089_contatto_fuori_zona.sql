-- «Contattato, interessato ma fuori zona».
--
-- Perché
-- ------
-- È l'esito più frequente delle chiamate di questi giorni e non aveva un posto
-- dove stare: finiva in «non interessato», che è falso e per giunta dannoso —
-- quella persona ci vuole, siamo noi a non arrivarci. Messa lì, il giorno che si
-- apre la zona nessuno sa più chi richiamare.
--
-- Il vincolo va su entrambe le tabelle, come il 0079: in Persone lead e clienti
-- stanno nella stessa lista e lo stato si scrive ora sull'una ora sull'altra. Se
-- il vocabolario è lo stesso, lo deve dire il database in tutti e due i posti.

alter table public.leads drop constraint if exists leads_contact_status_check;
alter table public.leads add constraint leads_contact_status_check
  check (contact_status in ('da_contattare','in_corso','in_attesa','fuori_zona','non_interessato','non_esiste','convertito'));

alter table public.profiles drop constraint if exists profiles_contact_status_check;
alter table public.profiles add constraint profiles_contact_status_check
  check (contact_status is null or contact_status in ('da_contattare','in_corso','in_attesa','fuori_zona','non_interessato','non_esiste','convertito'));

comment on column public.leads.contact_status is
  'Stato di lavorazione del contatto. «fuori_zona» = interessato davvero, ma il suo CAP non lo serviamo: è una lista da richiamare quando si apre la zona, non un rifiuto.';
