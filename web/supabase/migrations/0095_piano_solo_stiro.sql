-- Il solo stiro diventa un piano che si compra da soli.
-- =====================================================
--
-- Perché
-- ------
-- Fino a ieri il solo stiro si attivava **a mano**: l'ops creava un link di
-- pagamento su misura e lo mandava al cliente. Va bene per le prime tre
-- persone, non per chi arriva dalla pagina «servizio stiro a domicilio» alle
-- undici di sera e vuole abbonarsi senza chiedere niente a nessuno.
--
-- Quindi il solo stiro diventa un piano come gli altri, dentro `plans`: lo si
-- sceglie nell'onboarding, si paga con lo stesso checkout e si rinnova da solo.
--
-- Cosa lo rende diverso dagli altri tre
-- -------------------------------------
-- Il lavoro, non il prezzo: lo stiro lo fa la stireria di Arluno, si ritira il
-- mercoledì e torna in 48 ore invece che in 72. Serviva un modo di dirlo sulla
-- riga del piano, perché da lì deve discendere **tutto il resto**: il servizio
-- scritto sul profilo quando il pagamento va a buon fine, e con quello
-- l'instradamento del sacco e le fasce che il cliente vede in app.
--
-- `servizio` e non un `code` da interpretare: un codice è un'etichetta, e
-- leggere il comportamento da una stringa come 'stiro_small' vuol dire che il
-- giorno in cui qualcuno rinomina il piano il bucato va nel posto sbagliato.
--
-- Niente `stripe_price_id`
-- -----------------------
-- Il prezzo su Stripe non c'è: il checkout lo costruisce al volo con
-- `price_data`, come fa già il link su misura. Così un piano nuovo si aggiunge
-- da qui senza aprire la dashboard di Stripe, e cambiare il prezzo non lascia
-- in giro un price vecchio da ricordarsi.

alter table public.plans
  add column if not exists servizio text;

alter table public.plans
  drop constraint if exists plans_servizio_valido;

alter table public.plans
  add constraint plans_servizio_valido
  check (servizio is null or servizio in ('lavanderia', 'stiro'));

comment on column public.plans.servizio is
  'Che lavoro vende questo piano. null = lavanderia (i piani storici, lava e stira). ''stiro'' = solo stiro: va alla stireria, si ritira nelle fasce dello stiro e torna in 48 ore.';

-- I tre piani storici sono lavanderia, e dirlo è meglio che lasciarlo
-- sottinteso: una colonna vuota si legge «non lo so», non «è quello di prima».
update public.plans set servizio = 'lavanderia' where servizio is null;

-- Il piano del solo stiro. 122,00 € al mese = 25,00 € a settimana × 4 + IVA,
-- il prezzo concordato il 13 ottobre 2026. Un sacco a settimana, come lo Small.
insert into public.plans (code, name, price_month_cents, pickups_per_week, bags_per_week, turnaround_hours, active, sort, servizio, stripe_price_id)
select 'stiro', 'Solo stiro', 12200, 1, 1, 48, true, 10, 'stiro', null
where not exists (select 1 from public.plans where code = 'stiro');
