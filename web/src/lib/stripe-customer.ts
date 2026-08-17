import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

/** Dati anagrafici da tenere allineati sul cliente Stripe.
 *
 *  Finora al cliente Stripe passavamo la sola email. Nome, telefono e indirizzo
 *  ce li abbiamo già in casa e servono comunque: sulla ricevuta Stripe, nella
 *  riconciliazione dei pagamenti, in caso di contestazione di un addebito e in
 *  qualunque strada fiscale si prenda — non dipende dalla decisione su fattura
 *  o corrispettivi. Passarli costa una chiamata che facciamo già. */
type Anagrafica = {
  name?: string;
  phone?: string;
  address?: { line1: string; postal_code?: string; city?: string; country: "IT" };
};

/** Legge dal nostro database ciò che serve a Stripe per identificare la persona. */
export async function anagraficaCliente(supabase: SupabaseClient, userId: string): Promise<Anagrafica> {
  const [{ data: prof }, { data: addr }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle<{ full_name: string | null; phone: string | null }>(),
    supabase
      .from("addresses")
      .select("street, civico, cap")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ street: string; civico: string | null; cap: string | null }>(),
  ]);

  const out: Anagrafica = {};
  if (prof?.full_name?.trim()) out.name = prof.full_name.trim();
  if (prof?.phone?.trim()) out.phone = prof.phone.trim();
  if (addr?.street?.trim()) {
    // `street` sui record vecchi contiene già il civico; su quelli nuovi il
    // civico sta a parte. Concatenare senza controllare produceva indirizzi
    // tipo "Via Pizzi 24 24", che è il genere di dettaglio che poi si legge su
    // una fattura.
    const via = addr.street.trim();
    const civico = addr.civico?.trim();
    const line1 = civico && !via.endsWith(civico) ? `${via} ${civico}` : via;
    out.address = { line1, postal_code: addr.cap ?? undefined, city: "Milano", country: "IT" };
  }
  return out;
}

/** Crea il cliente Stripe con l'anagrafica completa. */
export async function creaClienteStripe(supabase: SupabaseClient, userId: string, email?: string) {
  const dati = await anagraficaCliente(supabase, userId);
  return stripe().customers.create({
    email,
    ...dati,
    metadata: { supabase_user_id: userId },
  });
}

/** Riallinea un cliente Stripe già esistente.
 *
 *  Best-effort: se fallisce non deve impedire un pagamento. Serve per i clienti
 *  creati prima, che su Stripe hanno la sola email, e per chi cambia indirizzo. */
export async function allineaClienteStripe(supabase: SupabaseClient, userId: string, customerId: string) {
  try {
    const dati = await anagraficaCliente(supabase, userId);
    if (!dati.name && !dati.phone && !dati.address) return;
    await stripe().customers.update(customerId, dati);
  } catch (err) {
    console.error(`[stripe] allineamento anagrafica di ${customerId} fallito:`, err);
  }
}
