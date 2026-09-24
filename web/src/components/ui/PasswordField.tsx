"use client";

import { useId, useState } from "react";
import { passwordFacile, AVVISO_PASSWORD_FACILE } from "@/lib/password-weak";

/** Campo password con avviso quando la password è facilmente riconoscibile.
 *
 *  L'avviso NON blocca: nessun `disabled`, nessun `aria-invalid`, il form resta
 *  inviabile. È voluto — chi si sta iscrivendo non deve essere respinto per la
 *  password che ha scelto.
 *
 *  Compare solo quando il campo perde il fuoco o supera i 7 caratteri, non a
 *  ogni tasto: lampeggiare mentre uno digita "password123" è fastidioso e fa
 *  chiudere la pagina.
 *
 *  Due temi perché i form di accesso stanno su fondo navy e il cambio password
 *  nel profilo su fondo chiaro; le classi degli input erano già copiaincollate
 *  in quattro file, qui almeno stanno in un posto solo. */

const CLASSI = {
  navy: "h-[54px] w-full rounded-[18px] border-2 border-white/15 bg-white/[0.08] px-4 text-base font-semibold text-white placeholder:font-medium placeholder:text-white/45 outline-none transition-colors focus:border-cyan focus:bg-white/[0.12]",
  light: "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue",
} as const;

const AVVISO = {
  navy: "text-[#ffca6b]",
  light: "text-[#B4780F]",
} as const;

export function PasswordField({
  value,
  onChange,
  tema = "navy",
  placeholder = "Password (min 8 caratteri)",
  autoComplete = "new-password",
  email,
  nome,
  required,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  tema?: keyof typeof CLASSI;
  placeholder?: string;
  autoComplete?: string;
  /** Servono a riconoscere la password che contiene il proprio nome o indirizzo email. */
  email?: string;
  nome?: string;
  required?: boolean;
  className?: string;
}) {
  const [toccato, setToccato] = useState(false);
  const avvisoId = useId();

  const mostra = (toccato || value.length > 7) && passwordFacile(value, email, nome);

  return (
    <div>
      <input
        type="password"
        minLength={8}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setToccato(true)}
        aria-describedby={mostra ? avvisoId : undefined}
        className={className ?? CLASSI[tema]}
      />
      {mostra && (
        <p id={avvisoId} className={`mt-1.5 text-[12px] font-semibold leading-snug ${AVVISO[tema]}`}>
          ⚠︎ {AVVISO_PASSWORD_FACILE}
        </p>
      )}
    </div>
  );
}
