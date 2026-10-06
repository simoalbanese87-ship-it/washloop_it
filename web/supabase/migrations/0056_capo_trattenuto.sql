-- Il capo resta in lavanderia, il sacco parte lo stesso.
--
-- Correzione di rotta sulla 0055, scritta lo stesso giorno.
--
-- Cosa avevo capito male
-- ---------------------
-- Alla domanda «se un capo richiede più tempo, come si fa?» avevo risposto
-- spostando la RICONSEGNA: la lavanderia dichiarava quanti giorni le
-- servivano, il sistema cercava una fascia nuova e riprogrammava tutto. Tre
-- bottoni da scegliere, una regola con quattro rami, una tabella di date.
--
-- La risposta vera, da Simone: «alla prossima consegna ti ridiamo anche il capo
-- con cui abbiamo avuto difficoltà. Se non è schedulata viene tenuto in
-- memoria e aggiunto alla prossima riconsegna. Stiamo parlando con una
-- lavanderia, non con un'agenzia che fa questo di lavoro.»
--
-- Cioè: **non si sposta niente.** Il sacco torna quando promesso, senza il capo
-- problematico. Quel capo resta sullo scaffale e viaggia con la riconsegna
-- successiva, qualunque essa sia — e se ancora non esiste, si aspetta. Non c'è
-- nessuna data da calcolare, e nessuna scelta da far fare a chi ha le mani
-- bagnate: si spunta una casella e basta.
--
-- L'unica cosa che il sistema deve davvero fare è **ricordarsene**, perché un
-- capo trattenuto e dimenticato è molto peggio di un capo consegnato macchiato.

alter table public.order_issues
  drop column if exists pronto_stimato,
  drop column if exists riconsegna_da,
  drop column if exists riconsegna_a;

alter table public.order_issues
  -- Quando la lavanderia ha deciso di tenerlo. Nullo = il capo è nel sacco.
  add column trattenuto_at  timestamptz,
  -- Quando è stato restituito. Finché è nullo, quel capo è ancora da noi e
  -- deve continuare a comparire davanti agli occhi di qualcuno.
  add column restituito_at  timestamptz,
  add column restituito_da  uuid references public.profiles(id) on delete set null;

-- La domanda che questa tabella riceverà più spesso da domani è «quali capi ho
-- ancora in casa?»: indice parziale su quelli aperti.
create index order_issues_trattenuti_idx
  on public.order_issues (created_at desc)
  where trattenuto_at is not null and restituito_at is null;

comment on column public.order_issues.trattenuto_at is
  'Il capo resta in lavanderia e tornerà con la prossima riconsegna. Il sacco parte lo stesso, alla data promessa.';
comment on column public.order_issues.restituito_at is
  'Quando il capo è stato davvero riconsegnato. Nullo = ancora in lavanderia.';
