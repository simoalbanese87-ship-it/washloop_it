-- Storage per le foto prova di ritiro/consegna del corriere.

insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;

-- Solo staff (corriere/partner/admin) può caricare
create policy "proofs upload staff" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proofs' and public.auth_role() in ('courier', 'partner', 'admin'));

-- Lettura pubblica (bucket pubblico, URL diretti)
create policy "proofs read" on storage.objects
  for select using (bucket_id = 'proofs');
