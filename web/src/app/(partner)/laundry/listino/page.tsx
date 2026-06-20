import { Card, PageTitle } from "@/components/app/AppShell";
import { createClient } from "@/lib/supabase/server";
import type { ListItem } from "@/components/app/AddSpecialForm";

export const dynamic = "force-dynamic";

function eur(c: number) {
  return (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export default async function ListinoPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_special_items")
    .select("id, category_id, category_name, category_emoji, name, comp_lav_cents")
    .order("category_sort", { ascending: true })
    .order("sort", { ascending: true })
    .returns<ListItem[]>();

  const items = data ?? [];
  const cats = new Map<string, { label: string; items: ListItem[] }>();
  for (const it of items) {
    if (!cats.has(it.category_id)) cats.set(it.category_id, { label: `${it.category_emoji} ${it.category_name}`, items: [] });
    cats.get(it.category_id)!.items.push(it);
  }

  return (
    <>
      <PageTitle
        kicker="Portale lavanderia"
        title="Listino capi speciali"
        sub="Compenso riconosciuto alla lavanderia per capo. Il prezzo cliente non è visibile."
      />

      <div className="space-y-6">
        {[...cats.values()].map((cat) => (
          <Card key={cat.label}>
            <h2 className="font-display text-lg font-extrabold text-navy">{cat.label}</h2>
            <ul className="mt-3 divide-y divide-line">
              {cat.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-navy">{it.name}</span>
                  <span className="font-display font-extrabold text-navy">{eur(it.comp_lav_cents)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm font-medium text-muted">Listino non disponibile.</p>}
      </div>
    </>
  );
}
