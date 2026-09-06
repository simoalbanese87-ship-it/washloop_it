-- Note interne sul cliente, come già esistono sull'ordine.
--
-- `orders.staff_notes` c'è da sempre e serve per il singolo ritiro. Ma le cose
-- che contano su una persona non stanno dentro un ritiro: un accordo preso al
-- telefono, un claim aperto, «suona il campanello del vicino», «paga sempre in
-- ritardo ma paga». Finora finivano nella testa di chi ha risposto, e alla
-- domanda successiva non c'erano più.
--
-- Perché una tabella a parte e non una colonna su `profiles`
-- ----------------------------------------------------------
-- Il primo tentativo era una colonna `profiles.staff_notes` con il privilegio
-- revocato ai ruoli del cliente. **Non funziona**, ed è stato verificato invece
-- che darlo per buono: in PostgreSQL una `GRANT SELECT` a livello di tabella
-- copre tutte le colonne, comprese quelle aggiunte dopo, e una
-- `REVOKE SELECT (colonna)` su quel permesso non toglie niente.
-- `has_column_privilege('authenticated', 'profiles', 'staff_notes', 'SELECT')`
-- continuava a rispondere `true`: la nota sarebbe stata leggibile proprio dalla
-- persona di cui parla.
--
-- L'alternativa sarebbe revocare la SELECT sull'intera tabella e riconcederla
-- colonna per colonna. Fragile nel modo peggiore: il giorno in cui si aggiunge
-- una colonna a `profiles` e ci si dimentica la GRANT, l'area cliente smette di
-- funzionare — e il collegamento fra le due cose non lo trova nessuno.
--
-- Una tabella separata è sicura per costruzione: il cliente non ha nessun
-- permesso qui sopra, e nessuna colonna futura può cambiarlo per sbaglio.

create table public.customer_notes (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  note text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

comment on table public.customer_notes is
  'Appunti dell''amministrazione sui clienti. Non vanno mai mostrati al cliente: qui sopra non ha nessun permesso.';

alter table public.customer_notes enable row level security;

-- Una sola politica, per tutto: le note sono roba dell'amministrazione. Chi non
-- è admin non legge e non scrive, e non c'è una seconda politica che possa
-- allargare il perimetro senza che si veda.
create policy "customer_notes admin" on public.customer_notes
  for all using (is_admin()) with check (is_admin());
