/** Il login fuori dall'indice.
 *
 *  La pagina è un componente client, e un componente client non può esportare
 *  `metadata`: per questo la riga sta qui, nel layout che la avvolge.
 *
 *  Il motivo è lo stesso di `/onboarding`: risponde 200 con il title e la
 *  description del layout generale, cioè gli stessi della home. Un modulo di
 *  accesso che compete con la home per le stesse parole non serve a nessuno,
 *  meno che mai a chi cerca una lavanderia. */
export const metadata = {
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
