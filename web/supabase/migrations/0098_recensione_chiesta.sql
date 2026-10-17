-- La recensione si chiede una volta sola, dopo la prima consegna riuscita.
-- =======================================================================
--
-- Perché
-- ------
-- Oggi non la chiede nessuno. Il promemoria è scritto da settimane nella
-- pagina «Crescita» del pannello — «aggiungi un link recensione nell'email
-- Consegnato, obiettivo una ogni cinque ordini» — e nel frattempo la scheda
-- Google ha **una** recensione, mentre le consegne andate a buon fine sono
-- ventinove.
--
-- Perché serve una colonna, e non basta contare gli ordini
-- --------------------------------------------------------
-- Chiedere due volte la stessa cosa alla stessa persona è il modo più rapido
-- per non ottenerla. Il conteggio degli ordini dice *quando* è la prima
-- consegna, ma non dice se la richiesta è già partita: una consegna annullata
-- e rifatta, un ordine corretto a mano, una riconsegna fallita e ripetuta
-- cambiano il conteggio e farebbero ripartire l'invito.
--
-- Stesso schema di `welcome_sent_at` e dei promemoria: si scrive con un update
-- condizionale su `is null`, così due esecuzioni contemporanee non possono
-- mandarne due.

alter table public.profiles
  add column if not exists recensione_chiesta_at timestamptz;

comment on column public.profiles.recensione_chiesta_at is
  'Quando abbiamo chiesto a questa persona di lasciare una recensione. Si scrive una volta sola: se c''è, non si chiede più.';
