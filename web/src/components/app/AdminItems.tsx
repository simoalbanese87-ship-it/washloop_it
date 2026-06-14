"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addItem, updateItemStatus, deleteItem } from "@/lib/actions/items";
import { Button } from "@/components/ui/Button";
import { ITEM_STATUS_LABEL, type ItemStatus } from "@/lib/orders";

export type Item = { id: string; kind: string | null; status: ItemStatus; photo_url: string | null };

const STATUSES: ItemStatus[] = ["received", "washing", "ready", "issue"];
const tone: Record<ItemStatus, string> = {
  received: "bg-navy/10 text-navy",
  washing: "bg-cyan/20 text-navy",
  ready: "bg-[#1F8A5B]/15 text-[#1F8A5B]",
  issue: "bg-[#C0392B]/12 text-[#C0392B]",
};
const input = "h-10 rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";

export function AdminItems({ orderId, items }: { orderId: string; items: Item[] }) {
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const path = `${orderId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("proofs").upload(path, file, { upsert: true });
    if (!error) setPhotoUrl(supabase.storage.from("proofs").getPublicUrl(path).data.publicUrl);
    setUploading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-extrabold text-navy">Capi ({items.length})</span>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 rounded-[12px] border border-line bg-ice px-3 py-2">
            {it.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.photo_url} alt="" className="h-9 w-9 rounded-[8px] object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-white text-sm">👕</div>
            )}
            <div className="flex-1 text-sm font-semibold text-navy">{it.kind ?? "Capo"}</div>
            <form action={updateItemStatus}>
              <input type="hidden" name="item_id" value={it.id} />
              <input type="hidden" name="order_id" value={orderId} />
              <select
                name="status"
                defaultValue={it.status}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className={`h-8 rounded-[8px] px-2 text-xs font-bold ${tone[it.status]}`}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{ITEM_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </form>
            <form action={deleteItem}>
              <input type="hidden" name="item_id" value={it.id} />
              <input type="hidden" name="order_id" value={orderId} />
              <button type="submit" className="font-display text-xs font-bold text-[#C0392B] hover:underline">✕</button>
            </form>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm font-medium text-muted">Nessun capo registrato.</p>}
      </div>

      {/* Aggiungi capo */}
      <form action={addItem} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="photo_url" value={photoUrl} />
        <input name="kind" required placeholder="Tipo (es. Camicia)" className={`${input} flex-1 min-w-40`} />
        <select name="status" defaultValue="received" className={input}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{ITEM_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <label className="flex h-10 cursor-pointer items-center rounded-[12px] border border-line bg-ice px-3 text-sm font-semibold text-navy">
          <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
          {uploading ? "Carico…" : photoUrl ? "✓ Foto" : "📷 Foto"}
        </label>
        <Button type="submit" size="md" variant="ghost-navy">Aggiungi</Button>
      </form>
    </div>
  );
}
