import { cn } from "@/lib/cn";

/* ============================================================
   Logo WashLoop — port del marchio dal Brandbook 2026.
   Le due "oo" di Loop sono bolle/oblò della lavatrice.
   Variant: "color" (su chiaro) · "white" (su navy) · "navy" (mono)
   ============================================================ */

type Variant = "color" | "white" | "navy";

type DrumColors = {
  fill: string;
  stroke: string;
  strokeW: number;
  rim: string;
  gloss: string;
  glossO: number;
};

function drumColors(variant: Variant): DrumColors {
  switch (variant) {
    case "white":
      return { fill: "transparent", stroke: "#fff", strokeW: 6.5, rim: "transparent", gloss: "#fff", glossO: 0 };
    case "navy":
      return { fill: "transparent", stroke: "#1b2d5e", strokeW: 6.5, rim: "transparent", gloss: "#1b2d5e", glossO: 0 };
    default:
      return { fill: "url(#wlBub)", stroke: "transparent", strokeW: 0, rim: "rgba(255,255,255,.6)", gloss: "#fff", glossO: 0.92 };
  }
}

function Drum({ c }: { c: DrumColors }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full overflow-visible">
      <g transform="translate(50 50)">
        <circle r="46" fill={c.fill} stroke={c.stroke} strokeWidth={c.strokeW} />
        <circle r="43" fill="none" stroke={c.rim} strokeWidth="2.4" />
        <path d="M-25 -25 A38 38 0 0 0 -32 -4" fill="none" stroke={c.gloss} strokeWidth="6.5" strokeLinecap="round" style={{ opacity: c.glossO }} />
        <circle cx="-15" cy="-21" r="6" fill={c.gloss} style={{ opacity: c.glossO ? 0.95 : 0 }} />
      </g>
    </svg>
  );
}

export function Logo({
  variant = "color",
  payoff = false,
  className,
  size = 64,
}: {
  variant?: Variant;
  payoff?: boolean;
  className?: string;
  size?: number;
}) {
  const c = drumColors(variant);
  const ink = variant === "white" ? "#fff" : "#1b2d5e";
  const accent = variant === "white" ? "#fff" : "#2b7fd4";

  return (
    <span
      className={cn("inline-flex flex-col items-start leading-none", className)}
      style={{ fontSize: size }}
      aria-label="WashLoop"
    >
      <span
        className="flex items-end font-display font-black"
        style={{ color: ink, letterSpacing: "-0.045em", lineHeight: 0.86, fontSize: "1em" }}
      >
        <span>WashL</span>
        <span className="inline-block" style={{ width: "0.78em", height: "0.78em", transform: "translateY(0.04em)" }}>
          <Drum c={c} />
        </span>
        <span className="inline-block" style={{ width: "0.6em", height: "0.6em", marginLeft: "-0.17em", marginRight: "-0.012em", transform: "translateY(0.17em)" }}>
          <Drum c={c} />
        </span>
        <span>p</span>
      </span>
      {payoff && (
        <span className="mt-[0.14em] self-stretch font-display font-extrabold" style={{ fontSize: "0.142em", letterSpacing: "0.004em", color: ink }}>
          Smetti di fare il bucato. <span style={{ color: accent }}>Inizia a vivere.</span>
        </span>
      )}
    </span>
  );
}

/* Simbolo standalone (icona app / favicon): due bolle isolate */
export function LogoSymbol({ variant = "color", className, size = 48 }: { variant?: Variant; className?: string; size?: number }) {
  const c = drumColors(variant);
  return (
    <span className={cn("inline-block", className)} style={{ width: size, height: size * 0.8 }} aria-label="WashLoop">
      <svg viewBox="0 0 220 176" aria-hidden className="block h-full w-full overflow-visible">
        <g transform="translate(82 100) scale(1)">
          <circle r="46" fill={c.fill} stroke={c.stroke} strokeWidth={c.strokeW} />
          <circle r="43" fill="none" stroke={c.rim} strokeWidth="2.4" />
          <path d="M-25 -25 A38 38 0 0 0 -32 -4" fill="none" stroke={c.gloss} strokeWidth="6.5" strokeLinecap="round" style={{ opacity: c.glossO }} />
        </g>
        <g transform="translate(150 106) scale(0.82)">
          <circle r="46" fill={c.fill} stroke={c.stroke} strokeWidth={c.strokeW} />
          <circle r="43" fill="none" stroke={c.rim} strokeWidth="2.4" />
        </g>
      </svg>
    </span>
  );
}
