-- 0040 — Chiude l'esposizione del listino interno e ripulisce i rilievi
--        dell'advisor Supabase.
--
-- L'alert critico che Supabase ha mandato via mail ("Table publicly accessible",
-- rls_disabled_in_public) era zone_caps, chiusa dalla 0037: oggi nessuna tabella
-- di public è senza RLS. Controllando il resto è però saltato fuori un problema
-- che l'advisor non segnala, perché non è un difetto tecnico ma commerciale.

-- ---------------------------------------------------------------------------
-- 1. Il margine era pubblico.
--
-- `special_items` ha policy `using (true)` e SELECT concesso ad anon: chiunque,
-- anche senza login, leggeva sulla stessa riga `price_cli_cents` (quanto paga il
-- cliente) e `comp_lav_cents` (quanto incassa la lavanderia). Verificato in
-- produzione: Piumone 15,40 € al cliente / 9,02 € alla lavanderia. Il margine di
-- ogni capo del listino era a disposizione di un concorrente con un browser.
--
-- RLS non aiuta: filtra righe, non colonne. Serve togliere l'accesso alla
-- tabella e dare ai clienti una vista con le sole colonne che li riguardano.
create or replace view special_items_public
with (security_invoker = off) as
  select id, category_id, name, price_cli_cents, sort
  from special_items
  where active;

comment on view special_items_public is
  'Listino capi speciali per il cliente: solo il prezzo che paga lui. Il compenso lavanderia (comp_lav_cents) non esce da qui.';

revoke select on special_items from anon, authenticated;
grant select on special_items_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. La vista partner del listino era leggibile da tutti.
--
-- `partner_special_items` espone comp_lav_cents ed è SECURITY DEFINER: non
-- passa dalle RLS. Le sorelle `partner_orders` e `partner_order_specials`
-- filtrano su my_laundry_id() e infatti a un cliente restituiscono 0 righe
-- (verificato impersonando un cliente vero); questa no, e a un cliente
-- qualunque restituiva tutte e 44 le voci di listino con i compensi.
create or replace view partner_special_items
with (security_invoker = off) as
  select si.id, si.category_id, sc.name as category_name, sc.emoji as category_emoji,
         sc.sort as category_sort, si.name, si.comp_lav_cents, si.sort
  from special_items si
  join special_categories sc on sc.id = si.category_id
  where si.active
    -- Chi non è una lavanderia non vede niente, esattamente come nelle altre
    -- due viste partner.
    and my_laundry_id() is not null;

-- ---------------------------------------------------------------------------
-- 3. Funzioni trigger raggiungibili via /rest/v1/rpc.
--
-- PostgREST pubblica come RPC ogni funzione di `public`. Queste hanno senso solo
-- attaccate a un trigger: chiamarle a mano non deve nemmeno essere possibile.
-- `gen_client_code` gira dentro handle_new_user (SECURITY DEFINER), quindi
-- togliere il permesso a anon/authenticated non rompe la registrazione.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.orders_touch_and_log() from anon, authenticated;
revoke execute on function public.profiles_guard_privileged_columns() from anon, authenticated;
revoke execute on function public.gen_client_code() from anon, authenticated;

-- security_audit() controlla già is_admin() al suo interno e la usa la pagina
-- /admin/sicurezza con la sessione dell'admin: resta a authenticated, esce da anon.
revoke execute on function public.security_audit() from anon;

-- NOTA: is_admin(), my_laundry_id(), auth_role() e can_see_order() NON vanno
-- toccate. Le policy RLS le invocano con i privilegi del ruolo che interroga:
-- revocargliele farebbe fallire con "permission denied" ogni query di un utente
-- normale. E comunque non rivelano nulla, dicono solo chi è chi chiama.

-- ---------------------------------------------------------------------------
-- 4. search_path fisso sul trigger di capacità slot (rilievo WARN).
alter function public.enforce_slot_capacity() set search_path = public, pg_catalog;
