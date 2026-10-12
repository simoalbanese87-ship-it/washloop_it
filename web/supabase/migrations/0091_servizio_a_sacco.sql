-- Il servizio a sacco: si paga il sacco, non il mese.
-- ===================================================
--
-- Perché serve una tabella nuova
-- ------------------------------
-- Tutto quello che sappiamo fare oggi è a canone: `plans` è un listino di
-- abbonamenti mensili, e il sacco per il cliente non ha un prezzo perché il suo
-- prezzo stava dentro il canone. Del sacco conosciamo solo il **costo**
-- (`laundries.bag_comp_cents`), cioè quanto prende la lavanderia.
--
-- Il solo stiro è un'altra cosa: un sacco da 30 litri, dentro quello che si
-- vuole, nessun limite di capi, e si paga quel sacco. Niente canone, niente
-- rinnovo, niente capi compresi. Serviva quindi un posto dove dire, per ogni
-- servizio: quanto paga il cliente, quanto prende la lavanderia, e **quale**
-- lavanderia lo fa — perché lo stiro lo fa la stireria di Arluno, non la
-- lavanderia storica.
--
-- I prezzi stanno qui e non nel codice: il giorno che Cristina alza di
-- cinquanta centesimi si cambia un numero dal pannello, non si fa un deploy.

create table if not exists public.servizi_sacco (
  id uuid primary key default gen_random_uuid(),
  codice text unique not null,
  nome text not null,
  laundry_id uuid references public.laundries(id) on delete set null,
  price_cli_cents int not null check (price_cli_cents >= 0),
  comp_lav_cents int not null check (comp_lav_cents >= 0),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.servizi_sacco is
  'Servizi che si pagano a sacco e non a canone (solo stiro, lavaggio a sacco). Non sono abbonamenti: niente rinnovo, niente capi compresi.';
comment on column public.servizi_sacco.price_cli_cents is 'Quanto paga il cliente per un sacco, IVA inclusa.';
comment on column public.servizi_sacco.comp_lav_cents is 'Quanto prende la lavanderia per quel sacco, IVA esclusa.';
comment on column public.servizi_sacco.laundry_id is 'Chi lo esegue. È anche il motivo per cui l''ordine viene instradato lì invece che alla lavanderia generale.';

-- Sull'ordine, perché il conto si fa su quello che è successo a quel ritiro:
-- se domani il prezzo cambia, i sacchi di ieri restano quelli di ieri.
alter table public.orders
  add column if not exists servizio_sacco_id uuid references public.servizi_sacco(id) on delete set null;

comment on column public.orders.servizio_sacco_id is
  'Il servizio a sacco di questo ritiro. Valorizzato = si paga a sacco, l''ordine va alla lavanderia del servizio e l''addebito parte quando la lavanderia ha contato i sacchi.';

-- Sul profilo, perché è una caratteristica del cliente: lo attiva l'admin e da
-- lì in poi ogni suo ritiro nasce già con il servizio giusto.
alter table public.profiles
  add column if not exists servizio_sacco_id uuid references public.servizi_sacco(id) on delete set null;

comment on column public.profiles.servizio_sacco_id is
  'Il servizio a sacco concordato col cliente. Si imposta dal pannello insieme ad a_consumo: da lì in poi i suoi ritiri nascono a sacco.';

create index if not exists orders_servizio_sacco_idx on public.orders (servizio_sacco_id) where servizio_sacco_id is not null;

-- L'addebito del sacco si registra in `customer_charges`, la stessa tabella
-- degli addebiti fatti a mano: così il ricavo entra in Competenza fra gli
-- addebiti e non si confonde con il canone, che su un cliente a sacco non
-- esiste. Mancava però il legame con l'ordine, e senza quello non si può dire
-- «questo ritiro è già stato addebitato» — cioè non si può essere idempotenti,
-- che su un addebito vuol dire addebitarlo due volte.
alter table public.customer_charges
  add column if not exists order_id uuid references public.orders(id) on delete set null;

comment on column public.customer_charges.order_id is
  'Il ritiro a cui si riferisce, quando ce n''è uno (addebito a sacco). Gli addebiti fatti a mano dal pannello non ce l''hanno.';

create unique index if not exists customer_charges_sacco_per_ordine
  on public.customer_charges (order_id)
  where kind = 'sacco' and status <> 'void';

-- ---------------------------------------------------------------- permessi --
--
-- Il cliente deve poter leggere quanto paga: senza, in app vedrebbe «paghi a
-- sacco» e nessun importo. Non deve invece vedere il compenso della lavanderia,
-- che è un dato nostro — e si nega **per colonna**, come su `special_items`,
-- perché una policy che lascia passare la riga lascia passare tutte le colonne.
alter table public.servizi_sacco enable row level security;

drop policy if exists servizi_sacco_lettura on public.servizi_sacco;
create policy servizi_sacco_lettura on public.servizi_sacco
  for select to anon, authenticated using (active);

drop policy if exists servizi_sacco_admin on public.servizi_sacco;
create policy servizi_sacco_admin on public.servizi_sacco
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke select on public.servizi_sacco from anon, authenticated;
grant select (id, codice, nome, price_cli_cents, active, sort) on public.servizi_sacco to anon, authenticated;
grant insert, update, delete on public.servizi_sacco to authenticated;

-- ------------------------------------------------------------------- dati ---
--
-- La stireria che fa solo questo: Cristina Antonini, Arluno.
--
-- Nasce **spenta**, e non è una dimenticanza. Accenderla è il gesto che fa
-- diventare due le lavanderie attive, e va fatto quando il resto è pronto: il
-- suo account partner, e il codice che sa instradare — `lavanderia-scelta.ts`,
-- che tiene le lavanderie dedicate a un servizio a sacco fuori dal conto del
-- ripiego. Accesa un minuto troppo presto, il ripiego storico («se la
-- lavanderia attiva è una sola usa quella») risponde «nessuna» e gli ordini
-- nascono senza lavanderia: invisibili nel portale, come il 14 settembre.
--
-- Si accende da /admin/lavanderia quando tocca.
insert into public.laundries (name, address, bag_comp_cents, active)
select 'Stireria Cristina Antonini (Arluno)', 'Via Scrofani 5, Arluno', 1240, false
where not exists (select 1 from public.laundries where name = 'Stireria Cristina Antonini (Arluno)');

insert into public.servizi_sacco (codice, nome, laundry_id, price_cli_cents, comp_lav_cents, sort)
select 'stiro', 'Solo stiro · sacco 30 L', l.id, 3050, 1240, 1
from public.laundries l
where l.name = 'Stireria Cristina Antonini (Arluno)'
  and not exists (select 1 from public.servizi_sacco where codice = 'stiro');

-- Il lavaggio a sacco esiste nel listino della stireria, ma da noi **non si
-- usa**: il lavaggio lo fa già la lavanderia storica e quel pezzo funziona.
-- Nasce quindi spento, come promemoria del prezzo e non come opzione da
-- scegliere per sbaglio su un cliente.
insert into public.servizi_sacco (codice, nome, laundry_id, price_cli_cents, comp_lav_cents, sort, active)
select 'lavaggio', 'Lavaggio · sacco 30 L', l.id, 4000, 1475, 2, false
from public.laundries l
where l.name = 'Stireria Cristina Antonini (Arluno)'
  and not exists (select 1 from public.servizi_sacco where codice = 'lavaggio');
