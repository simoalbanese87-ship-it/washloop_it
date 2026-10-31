-- Il giorno in cui i soldi si sono mossi.
-- =======================================
--
-- Perché
-- ------
-- Il 30 ottobre la Home diceva «€690,60 incassato questo mese» e la pagina
-- Incassi, per lo stesso mese, diceva «€733,10». Nessuna delle due era
-- sbagliata nel calcolo: contavano due cose diverse.
--
--   Home   = fatture pagate **lette da Stripe**, meno i rimborsi per il giorno
--            in cui il denaro è uscito. Un pagamento senza fattura Stripe —
--            un checkout `payment`, che emette solo un PaymentIntent — lì non
--            esiste: 30,50 € spariti.
--   Incassi = righe della tabella `invoices` per `created_at`, meno i rimborsi
--            **attribuiti al mese della ricevuta**. Un rimborso fatto il 12
--            ottobre su una ricevuta di settembre non toglieva niente a
--            ottobre: 12,00 € contati due volte, in pratica.
--
-- La cassa vera di ottobre era 721,10 €: tutto quello che è entrato meno tutto
-- quello che è uscito, contato per il giorno in cui si è mosso.
--
-- Il difetto sotto
-- ----------------
-- `created_at` ha **due significati** nella stessa colonna: sulle righe nate
-- dal webhook è l'istante in cui l'evento è arrivato (`registraIncasso` non la
-- valorizza, quindi resta il `now()` del default), su quelle rilette da Stripe
-- è la data di pagamento vera (`incassi-import.ts` la scrive a mano). Finché
-- il webhook arriva subito le due coincidono quasi sempre — ma «quasi» non è
-- una base su cui contare i soldi, e un webhook ritentato il giorno dopo
-- sposta un incasso di un giorno, o di un mese se è il 31.
--
-- Quindi la data dei soldi si scrive in una colonna sua, che significa una
-- cosa sola. `created_at` torna a essere quello che dice di essere: quando la
-- riga è nata.
--
-- Il travaso
-- ----------
-- Per le righe già in archivio l'unica data che abbiamo è `created_at`, e per
-- quelle importate è già quella giusta. Si copia: meglio un dato esatto al
-- giorno che una colonna vuota che obbliga ogni lettura a un `coalesce`.

alter table public.invoices
  add column if not exists incassato_at timestamptz;

update public.invoices
   set incassato_at = created_at
 where incassato_at is null;

comment on column public.invoices.incassato_at is
  'Il giorno in cui i soldi si sono mossi: la data di pagamento su Stripe, non quella in cui è arrivato il webhook. È l''unica data su cui si contano gli incassi. created_at resta quando è nata la riga.';

comment on column public.invoices.rimborsato_at is
  'Il giorno in cui i soldi sono tornati al cliente. È la data su cui si contano i rimborsi: un rimborso pesa sul mese in cui il denaro esce, non su quello della ricevuta che annulla.';

-- Le letture vanno sempre per finestra di date su queste due colonne.
create index if not exists invoices_incassato_idx on public.invoices (incassato_at);
create index if not exists invoices_rimborsato_idx on public.invoices (rimborsato_at) where rimborsato_at is not null;
