import type { Metadata } from "next";
import Link from "next/link";
import { Guida, type DatiGuida } from "@/components/marketing/Guida";
import { OG_IMMAGINE } from "@/lib/og";

const URL_PAGINA = "https://washloop.it/guide/come-stirare-una-camicia";

export const metadata: Metadata = {
  title: "Come stirare una camicia: l'ordine giusto in 5 minuti",
  description:
    "Colletto, polsini, maniche, carré, davanti, dietro: l'ordine conta più del ferro. Temperature per tessuto, e i tre errori che lasciano le pieghe doppie.",
  alternates: { canonical: "/guide/come-stirare-una-camicia" },
  openGraph: {
    title: "Come stirare una camicia in 5 minuti — WashLoop",
    description: "L'ordine giusto, le temperature per tessuto e i tre errori che fanno la piega doppia.",
    url: URL_PAGINA,
    type: "article",
    locale: "it_IT",
    images: [OG_IMMAGINE],
  },
};

const DATI: DatiGuida = {
  titolo: "Come stirare una camicia: l'ordine giusto in 5 minuti",
  sottotitolo:
    "Chi stira lentamente non è più preciso: è solo partito dal pezzo sbagliato. L'ordine è quello che usano le stirerie, e dimezza il tempo.",
  aggiornata: "29 ottobre 2026",
  minuti: 5,
  url: URL_PAGINA,
  chiusura: {
    titolo: "Cinque minuti a camicia, per quante camicie a settimana?",
    testo:
      "Se la risposta è quattro o cinque, è mezz'ora che torna ogni settimana. L'abbonamento solo stiro ritira i capi già lavati e te li riporta stirati e piegati in 48 ore.",
    cta: { href: "/servizio-stiro-a-domicilio-milano", testo: "Guarda il solo stiro" },
  },
};

export default function ComeStirareUnaCamicia() {
  return (
    <Guida dati={DATI}>
      <p>
        Una camicia stirata bene richiede cinque minuti, e il tempo non dipende dalla mano: dipende
        dall&apos;ordine. Si parte dai pezzi piccoli e doppi e si finisce con le superfici larghe,
        perché ogni volta che appoggi una parte già stirata sull&apos;asse per lavorarne un&apos;altra,
        la stropicci di nuovo. Chi parte dal dietro finisce per stirare tutto due volte.
      </p>

      <h2>Prima: due condizioni</h2>
      <ul>
        <li>
          <strong>La camicia deve essere leggermente umida.</strong> Una camicia asciutta del tutto
          non prende la piega: o la tiri fuori dallo stendino poco prima, o la inumidisci con lo
          spruzzino. Il vapore del ferro, da solo, su cotone pesante non basta.
        </li>
        <li>
          <strong>Il ferro deve essere caldo prima di iniziare.</strong> Stirare mentre si scalda
          significa passare due volte sugli stessi punti.
        </li>
      </ul>

      <h3>Temperatura, per tessuto</h3>
      <table>
        <thead>
          <tr>
            <th>Tessuto</th>
            <th>Ferro</th>
            <th>Nota</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Lino</td>
            <td>alto (3 punti)</td>
            <td>Vuole vapore abbondante e la camicia bella umida.</td>
          </tr>
          <tr>
            <td>Cotone</td>
            <td>alto (2–3 punti)</td>
            <td>Il caso normale. Vapore sì.</td>
          </tr>
          <tr>
            <td>Misto cotone/poliestere</td>
            <td>medio (2 punti)</td>
            <td>Troppo caldo lucida il tessuto scuro.</td>
          </tr>
          <tr>
            <td>Seta, viscosa</td>
            <td>basso (1 punto)</td>
            <td>Sempre dal rovescio, o con un panno di cotone sopra.</td>
          </tr>
        </tbody>
      </table>
      <p>
        Sui <strong>capi scuri</strong> stira dal rovescio: è la regola che evita l&apos;alone
        lucido sul blu e sul nero, che una volta fatto non si toglie.
      </p>

      <h2>L&apos;ordine: sei pezzi, sempre lo stesso</h2>
      <ol>
        <li>
          <strong>Colletto.</strong> Aprilo e stiralo dal rovescio, partendo dalle punte verso il
          centro: se vai dal centro verso le punte spingi il tessuto in avanti e crei la piega a
          ventaglio. Poi girarlo e ripassarlo dal diritto. Non schiacciare la piegatura ora: si fa
          alla fine, quando è fredda.
        </li>
        <li>
          <strong>Polsini.</strong> Sbottonali e aprili del tutto, rovescio prima. Stira intorno ai
          bottoni, mai sopra: sopra si schiacciano e si crepano.
        </li>
        <li>
          <strong>Maniche.</strong> Prendi la manica per la cucitura inferiore e appiattiscila
          tenendola tesa: la cucitura deve restare al bordo. Stira dalla spalla verso il polso. Se
          non vuoi la riga sulla manica — il taglio sportivo non la vuole — usa l&apos;asse stretta
          o infila un asciugamano arrotolato dentro la manica.
        </li>
        <li>
          <strong>Carré</strong>, cioè la parte sopra le spalle: infila l&apos;asse dentro la
          camicia come se fosse una spalla e lavora metà per volta.
        </li>
        <li>
          <strong>Davanti.</strong> Prima il lato con i bottoni, puntando il ferro fra un bottone e
          l&apos;altro; poi il lato delle asole. Sul taschino vai dal basso verso l&apos;alto, se
          no lo scolli.
        </li>
        <li>
          <strong>Dietro.</strong> Per ultimo, perché è la superficie più grande e la più facile da
          stropicciare mentre fai il resto.
        </li>
      </ol>

      <h2>I tre errori che costano una seconda passata</h2>
      <ul>
        <li>
          <strong>Appendere subito.</strong> Una camicia appena stirata è calda, e il tessuto caldo
          prende le pieghe di come lo appoggi. Lasciala due minuti distesa, poi appendila.
        </li>
        <li>
          <strong>Stirare il colletto per ultimo.</strong> È la parte che si vede di più e la più
          doppia: va fatta quando l&apos;asse è libera e la camicia è ancora umida.
        </li>
        <li>
          <strong>Riempire troppo l&apos;armadio.</strong> Camicie stirate pressate fra altre
          camicie tornano stropicciate: due dita di spazio fra una gruccia e l&apos;altra valgono
          più di dieci minuti di ferro.
        </li>
      </ul>

      <h2>Quanto tempo è, in un anno</h2>
      <p>
        Cinque minuti a camicia, cinque camicie a settimana: venticinque minuti, più lo stendere e
        il riporre. Fa circa <strong>venti ore all&apos;anno</strong> passate in piedi davanti a
        un&apos;asse. È il conto che ha senso fare prima di decidere se stirare in casa valga la
        pena — non quanto costa un ferro nuovo.
      </p>
      <p>
        Se la risposta è no, lo stiro si può staccare dal resto: il nostro{" "}
        <Link href="/servizio-stiro-a-domicilio-milano">abbonamento solo stiro</Link> ritira i capi
        che hai già lavato e li riporta stirati e piegati in 48 ore. E se invece vuoi togliere di
        mezzo anche il lavaggio, c&apos;è{" "}
        <Link href="/lavanderia-a-domicilio-milano">il servizio completo</Link>: ogni sacchetto
        comprende fino a 3 camicie stirate.
      </p>
    </Guida>
  );
}
