import { ImageResponse } from "next/og";

/** L'immagine che esce quando qualcuno incolla washloop.it da qualche parte.
 *
 *  Fino a oggi non c'era: ogni link condiviso su WhatsApp, in un gruppo di
 *  condominio o su LinkedIn usciva come un rettangolo grigio col titolo in
 *  piccolo. Non sposta il posizionamento — sposta i clic, e il passaparola
 *  passa quasi tutto da lì.
 *
 *  È disegnata nel codice e non è un file PNG: così quando cambia il payoff
 *  cambia anche l'anteprima, senza che nessuno debba ricordarsi di riaprire un
 *  programma di grafica. I colori sono quelli del tema (`--navy`, la bolla del
 *  logo), scritti qui per esteso perché ImageResponse non legge il CSS del
 *  sito. */

export const alt = "WashLoop — lavanderia a domicilio in abbonamento a Milano";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#1b2d5e",
          color: "white",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* La bolla del logo, nei colori del gradiente del sito. */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "linear-gradient(135deg, #a6f1ff 0%, #00c8f0 45%, #2b7fd4 100%)",
            }}
          />
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>WashLoop</div>
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -2.5,
            maxWidth: 940,
          }}
        >
          Smetti di fare il bucato. Inizia a vivere.
        </div>

        <div style={{ marginTop: 28, fontSize: 34, color: "#a6f1ff", fontWeight: 600 }}>
          Lavanderia a domicilio in abbonamento · Milano
        </div>

        <div style={{ marginTop: 18, fontSize: 27, color: "rgba(255,255,255,0.72)" }}>
          Ritiriamo, laviamo, stiriamo e ti riportiamo tutto a casa.
        </div>
      </div>
    ),
    size,
  );
}
