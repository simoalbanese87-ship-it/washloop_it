import type { Metadata } from "next";
import Link from "next/link";
import { Guida, type DatiGuida } from "@/components/marketing/Guida";
import { OG_IMMAGINE } from "@/lib/og";

const URL_PAGINA = "https://washloop.it/guide/come-lavare-un-piumone";

export const metadata: Metadata = {
  title: "Come lavare un piumone in lavatrice (e quando non farlo)",
  description:
    "Quanti kg serve la lavatrice, a che temperatura, con quale detersivo e perché l'asciugatura conta più del lavaggio. Con i casi in cui conviene portarlo in lavanderia.",
  alternates: { canonical: "/guide/come-lavare-un-piumone" },
  openGraph: {
    title: "Come lavare un piumone in lavatrice — WashLoop",
    description: "Kg, temperatura, detersivo e asciugatura. E i casi in cui la lavatrice di casa non basta.",
    url: URL_PAGINA,
    type: "article",
    locale: "it_IT",
    images: [OG_IMMAGINE],
  },
};

const DATI: DatiGuida = {
  titolo: "Come lavare un piumone in lavatrice (e quando non farlo)",
  sottotitolo:
    "La domanda vera non è «a quanti gradi»: è se il piumone ci sta. Ecco come capirlo prima di infilarlo nel cestello, e cosa fare quando la risposta è no.",
  aggiornata: "29 ottobre 2026",
  minuti: 6,
  url: URL_PAGINA,
  chiusura: {
    titolo: "Oppure lo mandi a noi e non ci pensi.",
    testo:
      "Un piumone singolo o matrimoniale si può mandare da solo, senza abbonamento: lo ritiriamo sotto casa, lo laviamo in lavanderia professionale con asciugatura industriale e te lo riportiamo asciutto e gonfio. Il prezzo lo vedi prima, a listino.",
    cta: { href: "/prezzi", testo: "Guarda il listino" },
  },
};

export default function ComeLavareUnPiumone() {
  return (
    <Guida dati={DATI}>
      <p>
        Il momento in cui ci si pone la domanda è sempre lo stesso: fine ottobre, il piumone esce
        dall&apos;armadio e odora di armadio. La tentazione è infilarlo in lavatrice e sperare. Va
        bene farlo, ma solo se tre cose tornano — e se non tornano, insistere è il modo più rapido
        per rovinarlo.
      </p>

      <h2>1. Il piumone ci sta davvero nel cestello?</h2>
      <p>
        È la condizione che conta più di tutte, e si verifica a secco, prima di bagnare qualsiasi
        cosa: metti il piumone nel cestello e <strong>deve restare almeno un terzo di spazio
        vuoto</strong>. Se riempie il cestello già da asciutto, da bagnato non si muoverà: la
        lavatrice girerà, l&apos;acqua entrerà e il sapone resterà dentro l&apos;imbottitura, dove
        non lo toglie più nessuno.
      </p>
      <p>Come regola di capienza, approssimata ma onesta:</p>
      <ul>
        <li>
          <strong>Piumone singolo</strong>: ci vuole una lavatrice da almeno 7 kg.
        </li>
        <li>
          <strong>Piumone matrimoniale</strong>: da 8 kg in su, meglio 9.
        </li>
        <li>
          <strong>Matrimoniale in piuma d&apos;oca, alto</strong>: le lavatrici di casa in genere
          non bastano. Serve un cestello da lavanderia.
        </li>
      </ul>
      <p>
        Le lavatrici da 6 kg, che sono la maggior parte di quelle installate nei bilocali, lavano
        bene un singolo leggero e nient&apos;altro.
      </p>

      <h2>2. Cosa dice l&apos;etichetta</h2>
      <p>
        Prima di decidere la temperatura, guarda il simbolo della bacinella. Se è barrato, in
        lavatrice non ci va e non c&apos;è trucco che tenga. Se dentro c&apos;è scritto 30 o 40,
        quello è il massimo: i piumoni sintetici reggono quasi sempre i 40°, quelli in piuma
        preferiscono i 30°.
      </p>
      <p>
        <strong>60° solo se l&apos;etichetta lo consente</strong>, ed è il caso dei sintetici
        antiacaro. A 60° l&apos;acqua è un disinfettante, sotto non lo è: se stai lavando per via
        di un&apos;allergia, questo è il numero che conta.
      </p>

      <h3>Programma e centrifuga</h3>
      <ul>
        <li>
          Programma <strong>piumoni</strong> se c&apos;è, altrimenti <strong>delicati</strong> con
          un risciacquo in più. Il risciacquo extra non è un vezzo: è quello che porta via il
          sapone rimasto nell&apos;imbottitura.
        </li>
        <li>
          <strong>Centrifuga bassa</strong>, 400–600 giri. Più alta spiaccica la piuma contro le
          cuciture e la rompe.
        </li>
      </ul>

      <h2>3. Il detersivo: poco, e liquido</h2>
      <p>
        Metà della dose normale, e liquido. La polvere non si scioglie bene a basse temperature e
        resta fra le piume, dove diventa quella rigidità grigiastra che poi si scambia per
        «piumone vecchio».
      </p>
      <p>
        <strong>Niente ammorbidente</strong>: incolla le piume fra loro e toglie proprio il gonfio
        che stai cercando di recuperare. Niente candeggina, nemmeno quella delicata, sui capi in
        piuma.
      </p>
      <p>
        Le palline da tennis — due o tre, pulite, dentro il cestello — servono davvero: battono
        l&apos;imbottitura mentre gira e le impediscono di compattarsi.
      </p>

      <h2>4. L&apos;asciugatura è il punto in cui si rovinano i piumoni</h2>
      <p>
        Qui si gioca tutto. Un piumone che resta umido al centro per due giorni prende odore di
        muffa dall&apos;interno, e quell&apos;odore non va più via: l&apos;umidità è dentro
        l&apos;imbottitura, dove l&apos;aria non arriva.
      </p>
      <ul>
        <li>
          <strong>Con l&apos;asciugatrice</strong>: calore basso, cicli lunghi, con le palline da
          tennis. Fermati ogni mezz&apos;ora, tiralo fuori e scuotilo per rompere i grumi.
        </li>
        <li>
          <strong>Senza asciugatrice</strong>: steso in orizzontale, mai appeso su un filo — il
          peso dell&apos;acqua tira tutta l&apos;imbottitura verso il basso e strappa le cuciture
          interne. Ci vogliono due o tre giorni, e in un appartamento milanese di novembre
          significa due o tre giorni di umidità in casa.
        </li>
      </ul>
      <p>
        <strong>È asciutto quando non si sentono più grumi</strong>: toccalo in più punti, anche al
        centro. Se un punto è freddo e compatto, è ancora bagnato dentro.
      </p>

      <h2>Quando non vale la pena provarci</h2>
      <p>Portalo in lavanderia, senza girarci intorno, se:</p>
      <ul>
        <li>la lavatrice è da 6–7 kg e il piumone è matrimoniale;</li>
        <li>è in <strong>vera piuma d&apos;oca</strong> e non hai un&apos;asciugatrice;</li>
        <li>l&apos;etichetta ha la bacinella barrata, o dice «solo lavaggio a secco»;</li>
        <li>c&apos;è una macchia estesa, di sangue o di muffa, che un lavaggio normale non toglie;</li>
        <li>siamo a novembre, in casa non hai dove stenderlo in piano e ti serve stanotte.</li>
      </ul>
      <p>
        In lavanderia non cambia il sapone: cambiano il cestello, che è tre volte il tuo, e
        l&apos;asciugatura, che è a flusso d&apos;aria calda controllata e finisce in qualche ora
        invece che in tre giorni. È quella la differenza che paghi.
      </p>

      <h2>Quanto costa farlo fare</h2>
      <p>
        Da noi un piumone singolo sta a listino a <strong>15,40 €</strong> e uno in piuma
        d&apos;oca a <strong>21,00 €</strong>, ritiro e riconsegna inclusi; una trapunta 21,00 €,
        una coperta in lana 16,80 €. Sono i prezzi pubblicati su{" "}
        <Link href="/prezzi">/prezzi</Link>, non un preventivo da chiedere. Non serve essere
        abbonati: un capo singolo si manda e basta.
      </p>
      <p>
        E se invece il problema sono i piumoni di tutta la casa a inizio stagione, ha senso
        guardare{" "}
        <Link href="/lavanderia-a-domicilio-milano">come funziona il ritiro a domicilio</Link>: il
        sacco parte il martedì mattina e rientra il venerdì.
      </p>
    </Guida>
  );
}
