-- Ogni email lascia una traccia.
--
-- Perché
-- ------
-- Il 4 settembre Saverio ha detto di non aver ricevuto il sollecito per il
-- pagamento fallito. In banca dati c'era scritto «inviato il 02/09 alle 20:24»
-- — ma quel campo lo scrive `inviaSollecito` **anche quando l'invio fallisce**,
-- di proposito, per non bloccare il resto del calendario. Quindi non era la
-- prova di un invio: era la prova di un tentativo.
--
-- E non esisteva nessun altro posto dove guardare. `sendMail` registrava i
-- fallimenti in `incidenti`, ma niente registrava i successi: alla domanda
-- «quella email è partita davvero?» non si poteva rispondere né sì né no. Per
-- un cliente che aspetta un ritiro, o che ci deve dei soldi, è la differenza
-- fra un disguido e una figuraccia.
--
-- Cosa si registra
-- ----------------
-- Una riga per ogni CHIAMATA a `sendMail`, compresi i casi in cui non parte
-- niente (SMTP non configurato, destinatario disiscritto). `message_id` è
-- quello che restituisce il server SMTP quando accetta il messaggio: è
-- l'identificativo da cercare nei log del provider quando qualcuno dice «non
-- mi è arrivata».
--
-- Non è un archivio: il corpo delle email non si salva. Serve a rispondere a
-- una domanda operativa, non a tenere copia della corrispondenza.

create type public.esito_email as enum ('inviata', 'saltata', 'fallita');

create table public.email_log (
  id          uuid primary key default gen_random_uuid(),
  destinatario text not null,
  oggetto     text not null,
  kind        text,                    -- 'servizio' | 'marketing'
  esito       public.esito_email not null,
  message_id  text,                    -- id assegnato dal server SMTP
  errore      text,                    -- perché non è partita
  created_at  timestamptz not null default now()
);

create index email_log_recente_idx on public.email_log (created_at desc);
-- «Che cosa ho mandato a questa persona?» è la domanda vera.
create index email_log_destinatario_idx on public.email_log (lower(destinatario), created_at desc);

comment on table public.email_log is
  'Traccia di ogni email transazionale: a chi, quando, con che esito. Serve a rispondere a «non mi è arrivata».';

alter table public.email_log enable row level security;

-- Solo admin, e solo in lettura: le righe le scrive il backend con il service
-- role. Qui dentro ci sono indirizzi email di clienti veri.
create policy "email_log admin read" on public.email_log
  for select using (is_admin());

grant select on public.email_log to authenticated;
