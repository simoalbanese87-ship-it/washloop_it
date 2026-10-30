-- I gettoni: comprare un ritiro senza comprare un abbonamento.
-- ============================================================
--
-- Perché
-- ------
-- Si vende «una settimana, un sacco» e quella settimana non si chiude mai.
-- Dentro i sette giorni il cliente prenota quante volte vuole, perché il
-- cancello — `puoPrenotare` — chiede una cosa sola: *l'abbonamento è vivo?*.
-- Il 22 ottobre Stefano caiola ha pagato 30,50 € per un ritiro e se n'è preso
-- un secondo gratis.
--
-- Il nodo non è il conteggio, è l'oggetto: di un sacco comprato non c'era
-- traccia da nessuna parte. C'erano tre strade e nessuna vendeva un sacco —
-- il pagamento una tantum dà i soldi e nessun diritto di prenotare; il flag
-- «a consumo» dà il diritto senza limite; l'abbonamento a termine dà sette
-- giorni illimitati. `bags_per_week` non c'entra: limita i sacchi **dentro**
-- un ritiro, non i ritiri.
--
-- Un acquisto non è un abbonamento
-- --------------------------------
-- Per vendere una settimana aprivamo un abbonamento Stripe di sette giorni e
-- gli mettevamo subito la disdetta: un acquisto travestito. Al settimo giorno
-- Stripe lo chiude, e un gettone non usato resta chiuso dentro un abbonamento
-- morto. Siccome il gettone **non scade** — è la decisione presa, «come un
-- gettone che non ha usato» — l'acquisto torna a essere quello che è: un
-- pagamento che accredita dei ritiri. Niente disdetta da programmare, niente
-- cron che avvisa della fine, niente che finisce: si consuma.
--
-- Niente casella che scende
-- -------------------------
-- Qui ci sono **solo gli accrediti**. I consumi sono gli ordini, che sono il
-- fatto: il saldo è la somma degli accrediti meno i ritiri non annullati che
-- hanno consumato un gettone. Annulli il ritiro e il gettone torna da solo,
-- senza che nessuno lo rimetta a mano. È la regola della 0096 — «i passaggi si
-- contano dagli ordini» — portata dove il ciclo di Stripe non c'è più.
--
-- Un contatore scritto a parte diverge dal reale al primo ordine annullato in
-- pannello, e quando i due numeri litigano nessuno sa quale credere.

create table if not exists public.gettoni (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  -- Quanti ritiri accredita questa riga. Sempre positivo: i consumi non stanno
  -- qui, stanno negli ordini.
  quanti int not null check (quanti > 0),
  motivo text not null check (motivo in ('acquisto', 'rinnovo', 'regalo', 'rettifica')),
  offer_id uuid references public.subscription_offers(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  -- Il movimento Stripe che ha pagato questi gettoni. Unico perché il webhook
  -- viene ritentato: senza, un retry accrediterebbe due volte gli stessi soldi.
  pagamento_ref text unique,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists gettoni_customer_idx on public.gettoni (customer_id, created_at desc);

comment on table public.gettoni is
  'Ritiri comprati e non ancora usati. Solo accrediti: il consumo è l''ordine con gettone_at valorizzato, e il saldo è la differenza fra i due. Un gettone non scade.';

comment on column public.gettoni.pagamento_ref is
  'Il payment_intent di Stripe. Unico: il webhook viene ritentato, e senza questo vincolo un retry accrediterebbe due volte.';

alter table public.gettoni enable row level security;

-- Stesso disegno di `subscriptions`: il proprietario legge il suo saldo,
-- l'admin tutto, e a scrivere è il webhook con il service client.
drop policy if exists "gettoni owner read" on public.gettoni;
create policy "gettoni owner read" on public.gettoni
  for select using (customer_id = auth.uid() or public.is_admin());

drop policy if exists "gettoni admin write" on public.gettoni;
create policy "gettoni admin write" on public.gettoni
  for all using (public.is_admin()) with check (public.is_admin());

-- Il consumo, scritto sull'ordine.
--
-- Serve perché gli ordini vengono prima dei gettoni: Stefano ne ha già due in
-- archivio, pagati in un altro modo. Contare *tutti* i suoi ordini vorrebbe
-- dire mangiarsi i gettoni nuovi per lavori già saldati. Dice «questo ritiro
-- l'ha pagato un gettone», e solo quelli contano.
alter table public.orders
  add column if not exists gettone_at timestamptz;

comment on column public.orders.gettone_at is
  'Quando questo ritiro ha consumato un gettone. null = pagato in un altro modo (abbonamento, a consumo, o prima che i gettoni esistessero). Un ordine annullato non conta: il gettone torna disponibile da solo.';

-- Quanti ritiri vende una proposta. Senza, la scheda del cliente direbbe solo
-- «61,00 €» e nessuno saprebbe più che erano due ritiri.
alter table public.subscription_offers
  add column if not exists gettoni int;

alter table public.subscription_offers
  drop constraint if exists subscription_offers_gettoni_positivi;

alter table public.subscription_offers
  add constraint subscription_offers_gettoni_positivi
  check (gettoni is null or gettoni > 0);

comment on column public.subscription_offers.gettoni is
  'Quanti ritiri accredita questa proposta quando viene pagata. null = non è una vendita di ritiri.';
