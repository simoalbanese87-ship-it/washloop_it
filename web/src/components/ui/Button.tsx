"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

/* Bottoni WashLoop — primary (gradiente), light (su navy), ghost, ghost-navy.
   Brandbook: radius pill 40px, h 56px, Nunito ExtraBold. */

type Variant = "primary" | "light" | "ghost" | "ghost-navy";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2.5 font-display font-extrabold tracking-[0.01em] rounded-[40px] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

const sizes: Record<Size, string> = {
  md: "min-h-[48px] px-6 text-[15px]",
  lg: "min-h-[56px] px-7 text-base",
};

const variants: Record<Variant, string> = {
  primary: "bg-grad text-white shadow-[var(--shadow-cy)] hover:brightness-105 hover:-translate-y-0.5",
  light: "bg-white text-navy shadow-[var(--shadow-md)] hover:-translate-y-0.5",
  ghost: "bg-transparent text-white border-2 border-white/35 hover:bg-white/10",
  "ghost-navy": "bg-transparent text-navy border-2 border-navy/30 hover:bg-navy/5",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

/** Rotellina: dice che il comando è stato preso.
 *
 *  Fra il clic e la risposta del server passa quasi sempre qualche decimo di
 *  secondo, e senza nulla che si muova non si capisce se il clic è arrivato —
 *  così si clicca due volte, e a volte si salva due volte. */
function Rotellina() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 flex-none animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
    />
  );
}

export function Button({
  variant = "primary",
  size = "lg",
  className,
  children,
  type,
  disabled,
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  // `useFormStatus` guarda la form che contiene questo bottone: vale zero se il
  // bottone sta fuori da una form, quindi si può usare sempre senza pensarci.
  const { pending } = useFormStatus();
  // `type` omesso dentro una form significa già "submit" per HTML: trattarlo
  // diversamente vorrebbe dire che un domani un bottone senza type resta muto
  // senza che nessuno se ne accorga.
  const inCorso = pending && (type === undefined || type === "submit");

  return (
    <button
      type={type}
      // Bloccato mentre lavora: è ciò che impedisce il doppio invio.
      disabled={disabled || inCorso}
      aria-busy={inCorso || undefined}
      className={cn(base, sizes[size], variants[variant], className)}
      {...rest}
    >
      {inCorso && <Rotellina />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "lg",
  className,
  children,
  href,
  ...rest
}: CommonProps & { href: string } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={cn(base, sizes[size], variants[variant], className)} {...rest}>
      {children}
    </Link>
  );
}
