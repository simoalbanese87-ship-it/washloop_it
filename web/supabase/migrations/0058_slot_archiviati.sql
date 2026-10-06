-- Le fasce si archiviano, non si cancellano.
--
-- Il requisito, da Simone: «le richieste dei clienti devono rimanere anche se
-- cancello tutto». Oggi è impossibile, e per una ragione strutturale: l'orario
-- di un ritiro esiste **solo** dentro `slots`. L'ordine non se lo porta dietro,
-- ci punta e basta. Per questo il vincolo `orders_pickup_slot_id_fkey` rifiuta
-- di far sparire una fascia occupata — e fa bene: toglierla lascerebbe
-- l'ordine senza orario e il cliente senza ritiro.
--
-- Il risultato però era il peggiore dei due mondi: chi rigenera il calendario
-- preme «Svuota future», restano le fasce occupate, e sembra che il pulsante
-- non funzioni proprio mentre sta facendo il suo lavoro. Le uniche che non
-- puoi togliere sono quelle che ti danno fastidio.
--
-- Archiviare risolve entrambe le cose senza toccare niente di fragile: la riga
-- resta dov'è, l'ordine continua a leggere giorno e ora, ma la fascia sparisce
-- dal calendario e non è più prenotabile da nessuno.
--
-- Scartata l'alternativa: copiare l'orario dentro `orders` e mettere le chiavi
-- a `set null`. Stessa promessa, ma tocca ogni lettura che fa
-- `pickup_slot:slots(...)` — decine di punti nel codice, alla prima settimana
-- di servizio vero. Non adesso.

alter table public.slots
  add column archived_at timestamptz;

-- Tutte le letture "quali fasce posso scegliere" filtrano su questa colonna:
-- indice parziale sulle vive, che sono la stragrande maggioranza delle query.
create index slots_vive_idx on public.slots (kind, starts_at) where archived_at is null;

comment on column public.slots.archived_at is
  'Fascia ritirata dal calendario: non più prenotabile. Gli ordini che ci puntano restano validi e conservano giorno e ora.';
