"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";

const input = "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue";

export function ChangePassword() {
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) setMsg({ ok: false, text: error.message });
    else {
      setMsg({ ok: true, text: "Password aggiornata." });
      setPwd("");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <PasswordField
        required
        value={pwd}
        onChange={setPwd}
        tema="light"
        placeholder="Nuova password (min 8 caratteri)"
        className={input}
      />
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-[#1F8A5B]" : "text-[#C0392B]"}`}>{msg.text}</p>}
      <Button type="submit" size="md" variant="ghost-navy" disabled={loading}>
        {loading ? "Aggiorno…" : "Cambia password"}
      </Button>
    </form>
  );
}
