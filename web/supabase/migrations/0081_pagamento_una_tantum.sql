-- Un link che incassa una volta sola.
--
-- Perché
-- ------
-- Una cliente vuole provare una settimana pagando. Fino a ieri l'unico link
-- generabile creava un **abbonamento mensile**: lei avrebbe pagato, e trenta
-- giorni dopo le sarebbe partito un secondo addebito che non aveva chiesto —
-- a meno che qualcuno si ricordasse di disdire lo stesso giorno. Ricordarsi non
-- è una garanzia, ed è il tipo di dimenticanza che si scopre da uno storno.
--
-- Il pagamento singolo non crea nessun abbonamento: si incassa, e se la persona
-- decide di restare l'abbonamento lo si attiva apposta.
--
-- Perché sulla stessa tabella
-- ---------------------------
-- `subscription_offers` esiste per non perdere i link generati: senza, un link
-- vive finché resta aperta la pagina che l'ha creato. Vale identico per questi.
-- Cambia una cosa sola — se è ricorrente o no — e quella va scritta, altrimenti
-- la scheda cliente mostrerebbe «40,00 €/mese» su un pagamento che si fa una
-- volta e basta.

alter table public.subscription_offers
  add column if not exists una_tantum boolean not null default false;

comment on column public.subscription_offers.una_tantum is
  'true = pagamento singolo, nessun abbonamento creato: si incassa e basta. false = abbonamento mensile ricorrente, che è il caso storico.';
