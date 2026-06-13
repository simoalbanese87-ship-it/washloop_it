import Stripe from "stripe";

/** Client Stripe lato server. Lazy: non esplode in build se la chiave manca. */
let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY mancante");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
