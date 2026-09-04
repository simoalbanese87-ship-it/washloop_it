-- Le ricevute hanno un numero.
--
-- Il registro incassi ha cinque righe vere, già in ordine di data, e Simone le
-- ha descritte come «sparpagliate». Il motivo è che non hanno un numero: sono
-- tutte in stato «ricevuta» e `fic_number` è vuoto, perché il ponte con Fatture
-- in Cloud è spento di proposito. Cinque importi con una data e nient'altro non
-- si leggono come un registro, si leggono come un mucchio.
--
-- Perché memorizzato e non calcolato
-- ----------------------------------
-- Numerare al volo ordinando per data sembra equivalente e non lo è: il giorno
-- in cui arriva un incasso con data anteriore — un pagamento riconciliato in
-- ritardo, una riga inserita a mano — tutti i numeri successivi scalerebbero di
-- uno. Un numero di ricevuta che cambia dopo essere stato comunicato non è un
-- numero di ricevuta. Si assegna una volta e resta.
--
-- Progressivo per anno, che è la convenzione italiana: «n. 3/2026».

alter table public.invoices
  add column numero_ricevuta int;

-- Le cinque esistenti, numerate in ordine di incasso: la più vecchia è la n. 1.
with numerate as (
  select id,
         row_number() over (
           partition by extract(year from created_at at time zone 'Europe/Rome')
           order by created_at, id
         ) as n
    from public.invoices
)
update public.invoices i
   set numero_ricevuta = numerate.n
  from numerate
 where numerate.id = i.id;

-- Due ricevute non possono avere lo stesso numero nello stesso anno. È il
-- vincolo che rende il numero affidabile invece che decorativo.
create unique index invoices_numero_anno_idx
  on public.invoices (extract(year from created_at at time zone 'Europe/Rome'), numero_ricevuta)
  where numero_ricevuta is not null;

comment on column public.invoices.numero_ricevuta is
  'Progressivo della ricevuta nell''anno solare. Assegnato all''incasso e mai più cambiato.';
