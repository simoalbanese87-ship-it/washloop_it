-- «Come ci hai conosciuto», chiesto a chi si iscrive.
-- ==================================================
--
-- Perché
-- ------
-- Di un contatto sappiamo da dove è **arrivato tecnicamente**: il tag di
-- Google Ads e il pixel di Meta raccontano le campagne, e partono comunque
-- solo dopo il consenso ai cookie. Ma i due canali che contano di più per un
-- servizio come questo non lasciano nessuna traccia:
--
--   il **passaparola** — «me l'ha detto una collega» — che non è un clic;
--   le **risposte degli assistenti** — ChatGPT, Perplexity, le AI Overviews —
--   che mandano traffico senza referrer e senza comparire in nessun rapporto.
--
-- Senza chiederlo, quei due canali restano invisibili per sempre: si
-- investirebbe dove si misura, cioè dove si è già, invece che dove funziona.
--
-- Una domanda sola, facoltativa
-- -----------------------------
-- Un campo a risposta libera darebbe dati che nessuno rilegge; un elenco
-- chiuso si conta. Facoltativo di proposito: è un'iscrizione, non un
-- questionario, e una domanda obbligatoria in più è gente che si ferma lì.
--
-- `null` vuol dire «non l'ha detto», non «nessuno dei precedenti»: sono due
-- cose diverse e contarle insieme falserebbe ogni percentuale.

alter table public.profiles
  add column if not exists come_conosciuto text;

alter table public.profiles
  drop constraint if exists profiles_come_conosciuto_check;

alter table public.profiles
  add constraint profiles_come_conosciuto_check
  check (come_conosciuto is null or come_conosciuto in (
    'passaparola',
    'assistente_ai',
    'ricerca_google',
    'social',
    'volantino',
    'rider_in_zona',
    'altro'
  ));

comment on column public.profiles.come_conosciuto is
  'Come il cliente dice di averci conosciuto, chiesto in iscrizione. Facoltativo: null = non ha risposto, che è diverso da «altro». Serve a vedere i canali che non lasciano traccia tecnica — il passaparola e le risposte degli assistenti.';
