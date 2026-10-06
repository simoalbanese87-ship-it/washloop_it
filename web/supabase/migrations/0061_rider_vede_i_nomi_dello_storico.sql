-- Il rider vede il nome di chi ha servito, anche dopo aver consegnato.
--
-- Il difetto, visto da Simone il 4 settembre
-- ------------------------------------------
-- Nello storico del corriere due righe su tre dicevano «Cliente / Cliente»
-- invece del nome. Non è un errore della pagina: è la politica di lettura.
--
--   profiles courier reads own jobs:
--     o.customer_id = profiles.id AND o.courier_id = auth.uid()
--     AND o.status <> ALL (ARRAY['delivered','completed','cancelled'])
--
-- Il nome del cliente smette di essere leggibile **nel momento esatto in cui
-- l'ordine si chiude**. Cioè: appena il rider preme «consegnato», la persona a
-- cui ha appena consegnato diventa anonima. E lo storico — che per definizione
-- contiene solo ordini chiusi — non può mostrare nessun nome, mai. Le due
-- righe anonime erano le consegne chiuse quella mattina; la terza aveva ancora
-- il nome solo perché quell'ordine non era ancora stato chiuso.
--
-- Perché togliere il filtro è la cosa giusta e non un allargamento
-- ---------------------------------------------------------------
-- Il rider quel nome lo ha già avuto in mano: gli è comparso sulla tappa, ha
-- suonato a quel campanello, ha consegnato di persona. Nascondergli dopo un
-- dato che ha già letto non protegge niente e rompe una pagina.
--
-- E soprattutto: è **incoerente con tutte le altre politiche del corriere**,
-- che il filtro sullo stato non ce l'hanno.
--
--   addresses courier:  o.address_id = addresses.id AND o.courier_id = auth.uid()
--   orders courier:     courier_id = auth.uid()
--   order_bags read:    order_id in (select id from orders where courier_id = auth.uid())
--
-- Oggi quindi il rider può rileggere per sempre **l'indirizzo di casa** di chi
-- ha servito, ma non il suo nome. Non è una scelta di riservatezza, è una riga
-- scritta in modo diverso dalle altre tre. Qui viene allineata a quelle.
--
-- Il perimetro resta lo stesso: solo i clienti di ordini assegnati a quel
-- rider. Chi non ha mai avuto un ordine con lui resta invisibile.

drop policy "profiles courier reads own jobs" on public.profiles;

create policy "profiles courier reads own jobs"
  on public.profiles for select
  using (
    exists (
      select 1 from public.orders o
       where o.customer_id = profiles.id
         and o.courier_id = auth.uid()
    )
  );
