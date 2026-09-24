-- La prima settimana gratuita si concede una per una, non a listino.
--
-- Perché si cambia
-- ----------------
-- Nel 0076 la prova stava su `plans.prova_giorni`, quindi valeva per chiunque
-- si iscrivesse dal sito. Non è quello che serve: l'offerta va fatta a chi la
-- merita, al telefono, mentre si concorda il prezzo — cioè nel momento in cui
-- l'amministrazione crea il link di abbonamento personalizzato.
--
-- Una casella su un piano attivo è una promessa fatta in anticipo a chiunque
-- passi di lì, e non c'è modo di ritirarla se non spegnendola per tutti. Una
-- spunta sul link è una decisione presa su una persona sola.
--
-- La colonna si toglie invece di lasciarla a zero: un campo che c'è, si vede
-- nel Catalogo e non fa niente è peggio che non averlo — prima o poi qualcuno
-- lo riaccende convinto che funzioni.

alter table public.plans drop column if exists prova_giorni;

-- Restano, e servono ancora: sono le colonne su cui vive una prova già partita,
-- da qualunque strada arrivi.
comment on column public.subscriptions.prova_tetto_at is
  'Il muro, congelato alla creazione e mai ricalcolato: è l''unica cosa che impedisce a una catena di prenota-e-disdici di allungare la prova all''infinito. Viaggia nei metadata della subscription perché al checkout questa riga non esiste ancora. Oggi lo mette solo il link di abbonamento personalizzato.';
