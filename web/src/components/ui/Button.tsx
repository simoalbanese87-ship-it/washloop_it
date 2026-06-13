import Link from "next/link";
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

export function Button({
  variant = "primary",
  size = "lg",
  className,
  children,
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...rest}>
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
