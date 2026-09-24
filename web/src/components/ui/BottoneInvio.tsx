"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

/** Pulsante d'invio con rotellina, per le form che non usano <Button>.
 *
 *  Mantiene le classi che gli passi: serve solo ad aggiungere il segnale che il
 *  comando è stato preso, senza ridisegnare niente. Mentre lavora si blocca —
 *  è ciò che impedisce di premere due volte e salvare due volte. */
export function BottoneInvio({
  className,
  children,
  attesa,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { attesa?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={rest.disabled || pending}
      aria-busy={pending || undefined}
      className={cn(className, pending && "opacity-70")}
      {...rest}
    >
      {pending && (
        <span
          aria-hidden
          className="mr-1.5 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]"
        />
      )}
      {pending && attesa ? attesa : children}
    </button>
  );
}
