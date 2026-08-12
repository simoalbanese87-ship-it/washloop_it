-- 0040 — Chiude l'esposizione del listino interno e ripulisce i rilievi
--        dell'advisor Supabase.
--
-- L'alert critico arrivato via mail ("Table publicly accessible",
-- rls_disabled_in_public, 9 agosto) era zone_caps, chiusa dalla 0037: oggi
-- nessuna tabella di public è senza RLS. Controllando il resto è però saltato
-- fuori un problema che l'advisor non segnala, perché non è un difetto tecnico
-- ma commerciale.

-- ---------------------------------------------------------------------------
-- 1. Il margine era pubblico.
--
-- `special_items` ha policy `using (true)` e SELECT concesso ad anon: sulla
-- stessa riga stanno `price_cli_cents` (quanto paga il cliente) e
-- `comp_lav_cents` (quanto incassa la lavanderia). Chiunque, anche senza login,
-- leggeva entrambi. Verificato in produzione: Piumone 15,40 € al cliente,
-- 9,02 € alla lavanderia. Il margine di ogni voce di listino era a disposizione
-- di un concorrente con un browser.
--
-- RLS non poteva bastare: filtra righe, non colonne. Serve il permesso per
-- colonna, che è il meccanismo giusto — così le RLS restano in gioco e il
-- compenso lo nega il motore, non una vista che gira coi privilegi del
-- proprietario e che domani qualcuno potrebbe allargare per sbaglio.
revoke select on special_items from anon, authenticated;
grant select (id, category_id, name, price_cli_cents, active, sort)
  on special_items to anon, authenticated;

-- Vista di comodo per l'app cliente (`select *` sulla tabella ora fallirebbe:
-- PostgREST chiederebbe anche le colonne negate). security_invoker = on: legge
-- coi privilegi di chi interroga, quindi eredita RLS e permessi di colonna.
create or replace view special_items_public
with (security_invoker = on) as
  select id, category_id, name, price_cli_cents, sort
  from special_items
  where active;

comment on view special_items_public is
  'Listino capi speciali per il cliente: solo il prezzo che paga lui. Il compenso lavanderia non passa di qui.';

grant select on special_items_public to anon, authenticated;

-- Stesso difetto sui capi già addebitati: la policy "ospec read" fa leggere al
-- cliente le proprie righe di `order_specials`, e in quelle righe c'è di nuovo
-- comp_lav_cents. La tabella oggi è vuota, quindi non è ancora uscito niente:
-- si chiude prima che si riempia. Il compenso lo leggono solo le metriche
-- admin, che girano con il service role.
revoke select on order_specials from anon, authenticated;
grant select (id, order_id, item_id, item_name, qty, price_cli_cents, added_by,
              charged_at, stripe_invoice_item, created_at, refunded_at, refund_ref)
  on order_specials to authenticated;

-- ---------------------------------------------------------------------------
-- 2. La vista partner del listino era leggibile da tutti.
--
-- `partner_special_items` espone comp_lav_cents ed è SECURITY DEFINER: non passa
-- dalle RLS. Le sorelle `partner_orders` e `partner_order_specials` filtrano su
-- my_laundry_id() e infatti a un cliente restituiscono 0 righe (verificato
-- impersonando un cliente vero); questa no, e a un cliente qualunque
-- restituiva tutte e 44 le voci con i compensi.
create or replace view partner_special_items
with (security_invoker = off) as
  select si.id, si.category_id, sc.name as category_name, sc.emoji as category_emoji,
         sc.sort as category_sort, si.name, si.comp_lav_cents, si.sort
  from special_items si
  join special_categories sc on sc.id = si.category_id
  where si.active
    -- Chi non è una lavanderia non vede niente, come nelle altre due viste.
    and my_laundry_id() is not null;

-- ---------------------------------------------------------------------------
-- 3. Funzioni trigger raggiungibili via /rest/v1/rpc.
--
-- PostgREST pubblica come RPC ogni funzione di `public`. Queste hanno senso solo
-- attaccate a un trigger.
--
-- La revoca va fatta a `public`, non ad anon/authenticated: in Postgres EXECUTE
-- è concesso a PUBLIC per default, quindi togliendolo ai singoli ruoli non
-- cambia nulla (l'ACL resta `=X/postgres` e la funzione resta chiamabile).
-- I trigger continuano a scattare: il permesso su una funzione trigger viene
-- verificato quando il trigger viene creato, non a ogni esecuzione — verificato
-- in transazione, un nuovo utente riceve ancora il suo client_code.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.orders_touch_and_log() from public;
revoke execute on function public.profiles_guard_privileged_columns() from public;
revoke execute on function public.gen_client_code() from public;

-- security_audit() controlla già is_admin() al suo interno e la usa
-- /admin/sicurezza con la sessione dell'admin: mantiene il grant esplicito a
-- authenticated, perde quello implicito a PUBLIC.
revoke execute on function public.security_audit() from public;

-- NOTA: is_admin(), my_laundry_id(), auth_role() e can_see_order() NON vanno
-- toccate. Le policy RLS le invocano con i privilegi del ruolo che interroga:
-- revocargliele farebbe fallire con "permission denied" ogni query di un utente
-- normale. E comunque non rivelano nulla, dicono solo chi è chi chiama.

-- ---------------------------------------------------------------------------
-- 4. search_path fisso sul trigger di capacità slot (rilievo WARN).
alter function public.enforce_slot_capacity() set search_path = public, pg_catalog;
