-- Segnalazioni della lavanderia: bucato macchiato, rovinato, o rovinato da noi.
--
-- Perché serve
-- ------------
-- Chi apre il sacco è l'unico che vede lo stato reale dei capi, e finora non
-- aveva un posto dove dirlo. Le due cose che poteva fare erano scrivere un capo
-- speciale (che è un addebito, non una segnalazione) o telefonare. Risultato:
-- il cliente scopriva la macchia rimasta aprendo il sacco riconsegnato, cioè
-- nel momento peggiore e senza nessuna traccia di com'era arrivato.
--
-- Perché il tipo è obbligatorio
-- -----------------------------
-- «Macchia» scritto aprendo il sacco e «macchia» scritto dopo il lavaggio sono
-- due comunicazioni diverse e due responsabilità diverse. Se il campo fosse
-- solo testo libero quella differenza si perderebbe proprio quando serve —
-- quando qualcuno contesta. Quindi tre tipi e nessuna terza via:
--
--   trovato_cosi  il capo è arrivato già così          → protegge WashLoop
--   non_rimosso   abbiamo lavato, la macchia resta     → prepara il cliente
--   danno         l'abbiamo rovinato noi in lavorazione → costa a WashLoop
--
-- Perché il danno non parte da solo
-- ---------------------------------
-- Le prime due raggiungono il cliente appena scritte: dirgli in ritardo che il
-- capo era già macchiato non serve a niente. La terza no. Una frase scritta di
-- fretta sul banco è un'ammissione di responsabilità, e il cliente va avvisato
-- insieme a cosa gli proponiamo — rimborso, rilavaggio, sostituzione. Quindi
-- nasce con `published_at` nullo: la vede subito l'ops, e la pubblica quando ha
-- deciso. Scelta di Simone il 01/09/2026, non un ripiego tecnico.

create type public.issue_kind as enum ('trovato_cosi', 'non_rimosso', 'danno');

create table public.order_issues (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  kind         public.issue_kind not null,
  -- Quale capo. Facoltativo perché a volte riguarda il sacco intero, ma senza
  -- non si capisce di cosa si parla: la form lo chiede sempre.
  capo         text,
  testo        text not null,
  -- Path dentro il bucket privato `proofs`, non una URL: si firma alla lettura.
  photo_url    text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),

  -- Quando il cliente è stato avvisato. Nullo = non lo sa ancora.
  published_at timestamptz,
  -- Quando l'ops l'ha chiusa, e come.
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles(id) on delete set null,
  resolution   text,

  constraint order_issues_testo_non_vuoto check (length(btrim(testo)) > 0)
);

create index order_issues_order_idx on public.order_issues (order_id, created_at desc);
-- Il pannello ops chiede sempre e solo «cosa c'è di aperto»: indice parziale.
create index order_issues_aperte_idx on public.order_issues (created_at desc) where resolved_at is null;

comment on table public.order_issues is
  'Segnalazioni della lavanderia sui capi: trovati già rovinati, macchie non rimosse, danni in lavorazione.';
comment on column public.order_issues.published_at is
  'Quando il cliente è stato avvisato. I danni nascono nulli: li pubblica l''ops insieme alla soluzione.';

alter table public.order_issues enable row level security;

-- `can_see_order()` è SECURITY DEFINER e copre già cliente, rider, lavanderia
-- dell'ordine e admin. Riusarla non è una scorciatoia: è l'unico modo corretto,
-- perché una sottoquery su `orders` dentro una policy verrebbe valutata con i
-- permessi di chi interroga — e la lavanderia su `orders` non ha SELECT.
-- (È esattamente l'inciampo che il 01/09 teneva fermo «Segna arrivato».)
create policy "issues read" on public.order_issues
  for select using (
    can_see_order(order_id)
    and (
      -- Il cliente vede solo ciò che gli è stato comunicato.
      published_at is not null
      or auth_role() in ('partner', 'admin')
    )
  );

create policy "issues partner insert" on public.order_issues
  for insert with check (can_see_order(order_id) and auth_role() = 'partner');

create policy "issues admin" on public.order_issues
  for all using (is_admin()) with check (is_admin());

grant select, insert on public.order_issues to authenticated;
grant update on public.order_issues to authenticated; -- ristretto dalla policy admin

-- ---------------------------------------------------------------------------
-- Foto: la lavanderia poteva caricarle ma non rivederle.
--
-- La policy di lettura del bucket controlla la proprietà dell'ordine con una
-- sottoquery su `orders`, che per la lavanderia restituisce zero righe: non ha
-- SELECT su quella tabella. Caricava la foto e poi non riusciva ad aprirla.
-- Stessa condizione, valutata nel modo giusto, tramite `can_see_order()`.
-- Il primo segmento del path è l'id dell'ordine, come già scrive il rider.
drop policy if exists "proofs read scoped" on storage.objects;
create policy "proofs read scoped" on storage.objects
  for select using (
    bucket_id = 'proofs'
    and (
      is_admin()
      or can_see_order(nullif((storage.foldername(name))[1], '')::uuid)
    )
  );
