-- Via «come ci hai conosciuto»: non era stata chiesta.
-- ====================================================
--
-- La 0113 l'aveva aggiunta il 31 ottobre 2026, insieme a un campo nel modulo
-- di iscrizione. L'idea era mia, scritta in un elenco di proposte e approvata
-- in blocco con un «fai le cose della lista»: non era un sì a quella voce.
--
-- Si toglie tutta, non si nasconde. Una colonna che resta lì «tanto non dà
-- fastidio» è esattamente il genere di cosa che fra un anno nessuno sa più
-- perché c'è, e che intanto compare in ogni `select *` e in ogni esportazione
-- di dati personali.
--
-- Nessun dato si perde: la domanda è stata in produzione poche ore e non ha
-- risposto nessuno. La 0113 resta nello storico — le migrazioni raccontano
-- anche gli errori, e riscriverle vorrebbe dire cancellare il motivo per cui
-- questa esiste.

alter table public.profiles
  drop constraint if exists profiles_come_conosciuto_check;

alter table public.profiles
  drop column if exists come_conosciuto;
