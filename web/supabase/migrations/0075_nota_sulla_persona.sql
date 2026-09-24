-- Una nota su ogni persona, anche su chi non è ancora un cliente.
--
-- Perché
-- ------
-- In /admin/persone si telefona, e non c'era dove scrivere cosa ci si è detti.
-- La casella esisteva solo nella scheda del singolo cliente, cioè due clic più
-- in là e solo per chi si è già registrato: chi telefona a un lead non aveva
-- niente, e quello che si erano detti restava in testa a una persona sola.
--
-- Per i clienti si usa `customer_notes`, che esiste già (0063) ed è la stessa
-- casella della scheda: scrivendo da un posto si vede dall'altro. Per i lead
-- serviva una colonna nuova.
--
-- Perché una colonna nuova e non `leads.notes`
-- -------------------------------------------
-- `leads.notes` è occupata: src/lib/funnel-import.ts ci scrive le risposte del
-- questionario del funnel, e le scrive **solo se il campo è vuoto**. Un admin
-- che scrivesse lì cancellerebbe quelle risposte, e l'import non le
-- rimetterebbe mai più. Due contenuti diversi nella stessa colonna, con uno dei
-- due che vince in silenzio.
--
-- Perché una colonna e non una tabella come customer_notes
-- -------------------------------------------------------
-- `customer_notes` è una tabella separata per una ragione precisa e scritta nel
-- 0063: su `profiles` c'è una GRANT SELECT che copre ogni colonna futura,
-- quindi una nota interna messa lì sarebbe leggibile dal cliente. Su `leads`
-- quel problema non esiste — la tabella ha solo policy admin (0033) e nessun
-- cliente la legge mai — e una colonna basta.

alter table public.leads
  add column if not exists nota_interna text;

comment on column public.leads.nota_interna is
  'Cosa ci siamo detti al telefono: nota interna scritta dall''ops. Diversa da `notes`, che contiene le risposte del questionario del funnel e la riempie l''import. Non unirle. Si cancella insieme al lead.';

comment on column public.leads.notes is
  'Le risposte del questionario del funnel, scritte da funnel-import.ts e solo se il campo è vuoto. NON è la nota dell''ops: quella sta in `nota_interna`.';
