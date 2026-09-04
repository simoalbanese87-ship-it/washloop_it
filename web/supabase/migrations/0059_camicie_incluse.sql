-- Le camicie incluse nel sacco le conta il sistema, non la memoria di chi compila.
--
-- Il problema, trovato il 4 settembre
-- -----------------------------------
-- «Ogni sacchetto contiene fino a 3 camicie» è scritto in sei punti dell'app —
-- home, landing, FAQ, prenotazione, listino piani — ed è parte dell'offerta che
-- il cliente compra. Ma **nessuna riga di codice la applica**: la regola vive
-- solo come frase sul modulo della lavanderia, che deve ricordarsene e fare la
-- sottrazione a mente.
--
-- Il 1° settembre la lavanderia ha registrato: 1 camicia a fabia (2 sacchi,
-- quindi 6 incluse) e 3 camicie a Giulia (1 sacco, quindi 3 incluse). Guardando
-- i numeri non si può dire se abbiano fatto bene o male, e questo è il punto:
--
--   - se hanno scritto le camicie IN PIÙ, gli addebiti sono corretti (fabia ne
--     aveva 7, Giulia 6);
--   - se hanno scritto QUANTE CE N'ERANO, allora erano tutte incluse e abbiamo
--     addebitato 14,00 € che non dovevamo.
--
-- Il database non lo sa perché non gliel'ha mai chiesto nessuno: memorizza solo
-- la quantità addebitata. Un'ambiguità del genere su un addebito automatico non
-- si risolve chiedendo alle persone di ricordare meglio — si toglie di mezzo.
--
-- Come si toglie
-- --------------
-- `incluse_per_sacco` dice quante unità di quel capo sono comprese in ogni
-- sacco (3 per la camicia, 0 per tutto il resto). `qty_totale` registra quante
-- ce n'erano davvero. Da lì la quantità da addebitare la calcola il sistema, e
-- resta scritto sia il totale sia la franchigia applicata: fra sei mesi si
-- potrà ricostruire ogni addebito senza chiedere a nessuno.

alter table public.special_items
  add column incluse_per_sacco int not null default 0;

comment on column public.special_items.incluse_per_sacco is
  'Quante unità di questo capo sono comprese in ogni sacco. 3 per la camicia: è promesso al cliente in home, FAQ e listino piani.';

update public.special_items set incluse_per_sacco = 3 where name = 'Camicia';

alter table public.order_specials
  -- Quante ne sono state trovate in tutto. `qty` resta la quantità ADDEBITATA.
  add column qty_totale int,
  -- Quante ne ha assorbite l'abbonamento. Scritto per poter rispondere a
  -- «perché mi avete addebitato questo?» senza rifare il conto a mano.
  add column qty_inclusa int not null default 0;

comment on column public.order_specials.qty_totale is
  'Quante unità sono state trovate nel sacco. `qty` è quante se ne addebitano: la differenza è la franchigia dell''abbonamento.';
