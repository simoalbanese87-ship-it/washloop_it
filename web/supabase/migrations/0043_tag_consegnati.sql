-- 0043 — Traccia a chi sono stati consegnati i tag QR per i sacchi.
--
-- Il tag si stampa una volta e resta sul sacco per sempre, quindi la domanda
-- operativa non è "chi ha un codice" (ce l'hanno tutti, glielo assegna il
-- trigger alla registrazione) ma "a chi ho già dato materialmente i cartellini".
-- Quella informazione non sta da nessuna parte nel sistema, e non è
-- ricostruibile a posteriori: nessun ordine, nessuna scansione permette di
-- dedurre se il cliente ha in mano i suoi tag o se sono ancora in stampante.
-- Con tre clienti la si tiene a mente, con trenta no.

alter table profiles
  add column if not exists tags_delivered_at timestamptz,
  add column if not exists tags_qty int,
  add column if not exists tags_delivered_by uuid references profiles(id) on delete set null;

comment on column profiles.tags_delivered_at is
  'Quando il cliente ha ricevuto i tag QR per i sacchi. Null = non ancora consegnati.';
comment on column profiles.tags_qty is
  'Quanti tag gli sono stati consegnati.';
comment on column profiles.tags_delivered_by is
  'Chi li ha consegnati (admin o rider), per sapere a chi chiedere in caso di dubbio.';

-- Il trigger della 0037 continua a proteggere ruolo, lavanderia e codice
-- cliente: queste colonne non lo riguardano e restano scrivibili solo dal
-- server, che passa dal service role.
