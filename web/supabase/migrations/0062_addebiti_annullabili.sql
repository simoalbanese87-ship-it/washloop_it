-- Un addebito segnato dalla lavanderia si deve poter togliere, e deve restare
-- scritto perché.
--
-- Il difetto
-- ----------
-- `refundOrderSpecial` gestiva già il caso «non ancora fatturato»: toglieva
-- l'invoice item da Stripe e rimetteva `charged_at` a NULL. Ma poi usciva, e
-- quel NULL riportava la voce esattamente allo stato «in attesa di essere
-- addebitata»: nella scheda ordine ricompariva il bottone **«Metti in fattura»**
-- e il capo si poteva riaddebitare. Chi aveva appena accolto un claim vedeva
-- l'operazione riuscire, e il sistema si teneva pronto a rifarla.
--
-- Insieme a quello mancavano altre due cose:
--   - il compenso alla lavanderia restava valido (`laundry_payouts`), quindi
--     pagavamo un capo che al cliente avevamo tolto;
--   - non restava **nessuna traccia**: né il motivo, né chi, né quando. Su un
--     claim è precisamente l'informazione che serve, e sei mesi dopo è l'unica
--     che permette di rispondere «perché questo capo non è stato pagato?».
--
-- Perché tre colonne nuove e non `refunded_at`
-- --------------------------------------------
-- «Rimborsato» e «annullato» sono due fatti contabili diversi: nel primo i
-- soldi si sono mossi due volte e da qualche parte esiste un rimborso Stripe,
-- nel secondo non si sono mossi mai. Metterli nella stessa colonna significa
-- perdere la differenza il giorno in cui serve — e serve solo quando qualcuno
-- contesta.

alter table public.order_specials
  add column annullato_at timestamptz,
  add column annullato_motivo text,
  add column annullato_da uuid references public.profiles(id) on delete set null;

comment on column public.order_specials.annullato_at is
  'Quando l''addebito è stato tolto senza che i soldi si fossero mossi. Diverso da refunded_at, che presuppone un incasso avvenuto e restituito.';
comment on column public.order_specials.annullato_motivo is
  'Perché è stato tolto: claim del cliente, errore della lavanderia, capo non nostro. Obbligatorio: un annullo senza motivo non si sa più difendere.';

-- Un capo o è annullato con un motivo, o non è annullato. Uno dei due senza
-- l'altro è una riga che non si sa leggere.
alter table public.order_specials
  add constraint order_specials_annullo_completo
  check (
    (annullato_at is null and annullato_motivo is null)
    or (annullato_at is not null and annullato_motivo is not null and length(trim(annullato_motivo)) > 0)
  );

-- Annullato e addebitato insieme non ha senso: annullare azzera `charged_at`.
-- È il vincolo che rende impossibile lo stato in cui il sistema era finito.
alter table public.order_specials
  add constraint order_specials_annullato_non_addebitato
  check (annullato_at is null or charged_at is null);
