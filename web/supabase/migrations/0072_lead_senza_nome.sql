-- Il nome non è più obbligatorio per lasciare un contatto.
--
-- Perché
-- ------
-- La home nuova chiede due cose: email e telefono. È una scelta di conversione,
-- non una dimenticanza — ogni campo in più è gente che non compila, e il nome
-- lo si chiede comunque durante la telefonata di verifica, che c'è sempre.
--
-- `full_name` era `not null` perché il primo form che ha scritto su questa
-- tabella lo chiedeva. Resta la colonna, resta compilata da chi arriva dalla
-- landing `/disponibilita` (che il nome lo chiede ancora): cambia solo che
-- adesso può mancare.
--
-- Chi legge questa colonna deve reggere il vuoto: la mail di conferma saluta
-- senza nome, e la conversione in cliente chiede all'admin di scriverlo prima.
-- Entrambe le cose sono già nel codice.

alter table public.leads alter column full_name drop not null;

comment on column public.leads.full_name is
  'Nome e cognome, se li abbiamo. La home li omette di proposito (due campi convertono meglio di tre) e li raccogliamo al telefono; la landing /disponibilita li chiede ancora.';
