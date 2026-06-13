/**
 * Tiny className combiner — niente dipendenze esterne.
 * Filtra falsy e unisce con spazio.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
