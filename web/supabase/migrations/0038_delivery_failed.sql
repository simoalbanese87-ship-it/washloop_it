-- 0038_delivery_failed.sql
-- Stato "consegna non riuscita": finora, se il cliente non era in casa, l'ordine
-- restava `out_for_delivery` per sempre e nessuno lo sapeva. Ora il rider lo
-- marca, il cliente viene avvisato e l'ordine finisce tra quelli da riprogrammare.

alter type order_status add value if not exists 'delivery_failed' after 'delivered';
