-- ============================================================
-- 0010 — Security audit per il pannello admin
-- Funzione che ispeziona lo stato di sicurezza del database e restituisce
-- un report JSON. Eseguibile SOLO da un admin (guard interno). SECURITY
-- DEFINER per leggere i cataloghi di sistema (pg_catalog), ma non espone
-- alcun dato sensibile: solo metadati di configurazione (RLS, policy, conteggi).
-- ============================================================

create or replace function security_audit()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  result jsonb;
  tables_no_rls text[];
  tables_no_policy text[];
  role_counts jsonb;
  profiles_total int;
  profiles_no_code int;
begin
  -- Solo admin.
  if not is_admin() then
    raise exception 'forbidden';
  end if;

  -- Tabelle pubbliche con RLS DISABILITATA (rischio: accesso non filtrato).
  select coalesce(array_agg(c.relname order by c.relname), '{}')
    into tables_no_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false;

  -- Tabelle con RLS attiva ma SENZA alcuna policy (di fatto bloccate o esposte).
  select coalesce(array_agg(c.relname order by c.relname), '{}')
    into tables_no_policy
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = true
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  -- Conteggi per ruolo (per intercettare admin/partner inattesi).
  select jsonb_object_agg(role, n) into role_counts
  from (select role::text as role, count(*) n from profiles group by role) t;

  -- Invariante privacy: ogni profilo deve avere il codice cliente anonimo.
  select count(*), count(*) filter (where client_code is null)
    into profiles_total, profiles_no_code from profiles;

  result := jsonb_build_object(
    'tables_without_rls', to_jsonb(tables_no_rls),
    'tables_without_policy', to_jsonb(tables_no_policy),
    'role_counts', coalesce(role_counts, '{}'::jsonb),
    'profiles_total', profiles_total,
    'profiles_without_client_code', profiles_no_code
  );
  return result;
end $$;

revoke all on function security_audit() from anon, authenticated;
grant execute on function security_audit() to authenticated;  -- la guard interna limita agli admin
