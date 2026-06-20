"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { addSpecial } from "@/lib/actions/partner";

export type ListItem = {
  id: string;
  category_id: string;
  category_name: string;
  category_emoji: string;
  name: string;
  comp_lav_cents: number;
};

const input =
  "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue";

function eur(c: number) {
  return (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export function AddSpecialForm({ orderId, items }: { orderId: string; items: ListItem[] }) {
  const [itemId, setItemId] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: ListItem[] }>();
    for (const it of items) {
      if (!map.has(it.category_id)) map.set(it.category_id, { label: `${it.category_emoji} ${it.category_name}`, items: [] });
      map.get(it.category_id)!.items.push(it);
    }
    return [...map.values()];
  }, [items]);

  const selected = items.find((i) => i.id === itemId);

  return (
    <form action={addSpecial} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_88px]">
        <select name="item_id" required value={itemId} onChange={(e) => setItemId(e.target.value)} className={input}>
          <option value="">Scegli un capo…</option>
          {grouped.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} · {eur(it.comp_lav_cents)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input type="number" name="qty" min={1} defaultValue={1} aria-label="Quantità" className={input} />
      </div>
      {selected && (
        <p className="text-sm font-medium text-muted">
          Compenso lavanderia: <span className="font-bold text-navy">{eur(selected.comp_lav_cents)}</span> a capo
        </p>
      )}
      <Button type="submit" size="md" disabled={!itemId}>
        Aggiungi capo
      </Button>
    </form>
  );
}
