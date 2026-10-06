-- Il cliente può leggere le proprie ricevute.
--
-- Il difetto
-- ----------
-- `/app/fatture` si intitola «Fatture» ed elenca gli oggetti invoice di
-- Stripe, col numero che Stripe assegna loro. Ma le fatture non le emette
-- Stripe: nel regime scelto la fattura è l'eccezione, la emettiamo noi da
-- Fatture in Cloud e solo a chi la chiede. Quello che accompagna ogni incasso è
-- una **ricevuta**, numerata da noi nella tabella `invoices`
-- (`numero_ricevuta`, oggi 1..9).
--
-- Quindi lo stesso pagamento aveva due numeri: il nostro nel registro admin, e
-- quello di Stripe mostrato al cliente sotto l'etichetta «Fattura». Di quei due
-- l'unico che possiamo difendere se qualcuno lo chiede è il nostro.
--
-- Perché serve una policy
-- -----------------------
-- Su `invoices` c'era solo `invoices admin`: il registro lo leggeva il pannello
-- e nessun altro. Perché il cliente veda le proprie righe — e **solo** quelle —
-- serve una policy in lettura sul proprio `user_id`. Niente scrittura: le righe
-- le scrive il webhook di Stripe col service role, ed è l'unico che deve poterlo
-- fare.

create policy "invoices cliente legge le proprie"
  on public.invoices for select
  to authenticated
  using (user_id = auth.uid());

comment on column public.invoices.numero_ricevuta is
  'Progressivo annuale della ricevuta, assegnato da noi. È il numero che il cliente vede in app e quello a cui rispondiamo: il numero della invoice di Stripe è un riferimento interno del fornitore, non un documento nostro.';
