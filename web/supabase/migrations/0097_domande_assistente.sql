-- Cosa chiede la gente, e dove l'assistente tace.
-- ===============================================
--
-- Perché
-- ------
-- L'assistente del sito risponde da mesi e non lascia traccia: nessuno sa
-- quali domande arrivano davvero, né quante volte risponde «non ho questa
-- informazione, scrivici». Quelle risposte sono il materiale più utile che
-- abbiamo — ognuna è una FAQ che manca — e finora finivano nel nulla.
--
-- L'unico modo di scoprire un buco era che se ne lamentasse qualcuno: cioè
-- quando era già andata male. È successo due volte, ed entrambe sono scritte
-- nei commenti del codice dell'assistente: Rozzano data per non coperta, e un
-- sacco extra a 45 € che non esiste in nessun listino.
--
-- Cosa NON c'è dentro
-- -------------------
-- Niente che identifichi chi ha scritto: nessun IP, nessuna sessione, nessun
-- numero di telefono, nessun collegamento al cliente. Serve a sapere **cosa**
-- si chiede, non chi lo chiede — e una tabella che non contiene dati personali
-- è una tabella che non si deve proteggere, cancellare o esportare a richiesta.
--
-- Il testo della domanda lo scrive una persona, quindi può contenere di tutto:
-- per questo la lettura è solo admin, e in pagina si mostra come dato grezzo.

create table if not exists public.domande_assistente (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Da dove arriva: oggi il riquadro del sito, domani la chat WhatsApp. Serve
  -- per capire se le domande cambiano col mezzo — su un telefono si chiede
  -- in modo diverso che su un computer.
  canale     text not null default 'sito' check (canale in ('sito', 'whatsapp')),
  domanda    text not null,
  risposta   text,
  -- Vero quando l'assistente ha ammesso di non sapere. È la colonna da cui si
  -- guarda: ordinata per frequenza, è l'elenco delle FAQ da scrivere.
  non_lo_so  boolean not null default false
);

create index if not exists domande_assistente_recenti_idx
  on public.domande_assistente (created_at desc);

create index if not exists domande_assistente_senza_risposta_idx
  on public.domande_assistente (created_at desc)
  where non_lo_so;

comment on table public.domande_assistente is
  'Le domande fatte all''assistente e se ha saputo rispondere. Nessun dato di chi scrive: serve a capire cosa manca nelle FAQ.';

alter table public.domande_assistente enable row level security;

create policy "domande assistente admin" on public.domande_assistente
  for all using (is_admin()) with check (is_admin());
