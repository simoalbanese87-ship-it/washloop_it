-- Un costo verso la lavanderia che non nasce da un ordine.
--
-- Perché
-- ------
-- Il compenso alla lavanderia si scrive da sé: un sacco riconsegnato, un capo
-- speciale registrato. Tutto passa da un ordine. Ma un capo può arrivare
-- **fuori dal sacco** — la cliente consegna un piumone a mano, o lo lascia
-- insieme a un ritiro di solo stiro dove quel lavoro non si può registrare — e
-- allora la lavanderia lo lavora e non ha nessun posto dove scriverlo. Dal
-- portale non si può: senza sacco non c'è la riga da compilare.
--
-- Finora l'unica strada era inventare un ordine per far nascere il compenso. Un
-- ordine finto però finisce nel board e nel giro del rider, e quello che
-- comincia come una scorciatoia contabile diventa un ritiro che qualcuno va a
-- fare: è già successo con un doppione, e la lavanderia non riusciva a
-- toglierselo di mezzo.
--
-- `laundry_payouts.order_id` è nullable da sempre e la pagina dei compensi già
-- raggruppa le righe senza ordine: mancava solo il **perché**. Una riga di soldi
-- senza una ragione scritta, fra un mese, è una cifra che nessuno sa difendere
-- davanti a un bonifico.

alter table public.laundry_payouts
  add column if not exists nota text;

comment on column public.laundry_payouts.nota is
  'Perché esiste questa riga, in parole. Obbligatoria di fatto sui costi inseriti a mano (order_id null): senza, davanti al bonifico resta una cifra che nessuno sa spiegare.';

-- `kind` finora valeva 'bag' o 'special', entrambi nati da un ordine. Il terzo
-- caso si chiama per quello che è, così in pagina si distingue a colpo d'occhio
-- da un compenso maturato da solo.
comment on column public.laundry_payouts.kind is
  'bag = compenso del sacco alla riconsegna · special = capo registrato sull''ordine · manuale = costo inserito a mano dall''ops, senza ordine (vedi nota).';
