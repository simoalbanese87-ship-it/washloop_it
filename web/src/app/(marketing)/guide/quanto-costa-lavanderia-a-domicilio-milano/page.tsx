import type { Metadata } from "next";
import Link from "next/link";
import { Guida, type DatiGuida } from "@/components/marketing/Guida";
import { OG_IMMAGINE } from "@/lib/og";

/* ============================================================
   Quanto costa la lavanderia a Milano — rilevazione del 29/10/2026

   Questa pagina esiste per una ragione sola: nessuno pubblica questo dato.
   Fra i tredici operatori guardati, nove hanno un listino online e **nessuno
   dei nove lo data**. Una rilevazione fatta a mano, con l'URL di ogni prezzo e
   la data in cui è stato letto, è l'unica cosa che questo sito può offrire che
   gli altri non hanno — ed è anche l'unico tipo di contenuto che qualcuno ha
   motivo di citare.

   Regola per chi la aggiorna: se un prezzo non si può rileggere sulla pagina
   indicata, si toglie. Meglio una tabella con tre righe vere che una con dieci
   righe di cui due inventate.
   ============================================================ */

const URL_PAGINA = "https://washloop.it/guide/quanto-costa-lavanderia-a-domicilio-milano";

export const metadata: Metadata = {
  title: "Quanto costa la lavanderia a domicilio a Milano",
  description:
    "Rilevazione su 13 lavanderie di Milano, ottobre 2026: camicia da 2,40 a 4,00 €, piumone da 15 a 25 €, e 4 su 11 non dicono quanto costa il ritiro.",
  alternates: { canonical: "/guide/quanto-costa-lavanderia-a-domicilio-milano" },
  openGraph: {
    title: "Quanto costa la lavanderia a domicilio a Milano — WashLoop",
    description: "13 operatori, prezzi letti uno per uno il 29 ottobre 2026. Con le fonti.",
    url: URL_PAGINA,
    type: "article",
    locale: "it_IT",
    images: [OG_IMMAGINE],
  },
};

const DATI: DatiGuida = {
  titolo: "Quanto costa la lavanderia a domicilio a Milano",
  sottotitolo:
    "Abbiamo guardato i prezzi di 13 lavanderie milanesi, uno per uno, il 29 ottobre 2026. Sotto trovi cosa pubblicano, cosa non pubblicano e quanto costa davvero una camicia.",
  aggiornata: "29 ottobre 2026",
  minuti: 8,
  url: URL_PAGINA,
  chiusura: {
    titolo: "E noi quanto costiamo?",
    testo:
      "Il nostro listino è pubblico, capo per capo, e l'abbonamento è un numero solo: 160 € al mese per un sacco a settimana, ritiro e riconsegna inclusi. Nessun minimo d'ordine, nessun costo di consegna a parte.",
    cta: { href: "/prezzi", testo: "Vedi prezzi e listino" },
  },
};

export default function QuantoCostaLavanderiaMilano() {
  return (
    <Guida dati={DATI}>
      <p>
        Chi cerca quanto costa far lavare i vestiti a Milano trova, nell&apos;ordine: pagine che
        dicono «prezzi chiari» senza prezzi, moduli per chiedere un preventivo, e app da scaricare
        per vedere un listino. Ci siamo messi a guardarli uno per uno.
      </p>
      <p>
        <strong>Come l&apos;abbiamo fatta.</strong> Tredici operatori: otto lavanderie e tintorie
        con ritiro a domicilio, tre servizi online a domicilio, due catene self-service con sedi a
        Milano. Ogni prezzo qui sotto è stato letto sulla pagina pubblica dell&apos;operatore il{" "}
        <strong>29 ottobre 2026</strong>, e accanto trovi il link. Dove il prezzo non c&apos;è,
        abbiamo scritto che non c&apos;è: non abbiamo stimato né fatto medie. Siamo una lavanderia
        a domicilio anche noi, quindi i nostri prezzi li trovi in fondo, nella stessa tabella degli
        altri.
      </p>

      <h2>Il dato che non ci aspettavamo: nessun listino ha una data</h2>
      <p>
        Nove operatori su tredici pubblicano un listino consultabile. <strong>Nessuno dei nove
        scrive quando l&apos;ha aggiornato.</strong> L&apos;unico riferimento temporale è il «©
        2026» in fondo alla pagina, che lo scrive il sito da solo e non dice niente su quando il
        prezzo è stato deciso. Significa che quando leggi «camicia 2,50 €» non hai modo di sapere
        se è il prezzo di questo autunno o di tre anni fa.
      </p>
      <p>
        Due listini, poi, si contraddicono da soli. La <a href="https://lavanderiavecchiamilano.it/listino-prezzi/" rel="nofollow noreferrer" target="_blank">Lavanderia Vecchia Milano</a> annuncia in
        home «camicie lavate e stirate a 2,20 €» e nel listino interno scrive 2,50 €. Il listino di{" "}
        <a href="https://www.afb-laundry.it/listino/" rel="nofollow noreferrer" target="_blank">AFB Lifestyle Laundry</a> contiene due versioni
        dello stesso elenco, con voci che non coincidono.
      </p>

      <h2>La camicia: da 2,40 € a 4,00 €</h2>
      <p>
        È il capo su cui si confrontano tutti, ed è anche quello su cui la forbice è più larga: il
        più caro costa <strong>il 67% in più</strong> del più economico, per lo stesso lavoro.
      </p>
      <table>
        <thead>
          <tr>
            <th>Operatore</th>
            <th>Lavata e stirata</th>
            <th>Solo stirata</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <a href="https://lavanderiasangottardo.it/listino-prezzi/" rel="nofollow noreferrer" target="_blank">Lavanderia San Gottardo</a>
            </td>
            <td>2,40 €</td>
            <td>1,70 €</td>
          </tr>
          <tr>
            <td>
              <a href="https://lavasecco5stelle.it/listino-prezzi-lavasecco-5-stelle-milano-lambrate/" rel="nofollow noreferrer" target="_blank">Lavasecco 5 Stelle</a>
            </td>
            <td>2,50 €</td>
            <td>2,00 €</td>
          </tr>
          <tr>
            <td>
              <a href="https://lavanderiavecchiamilano.it/listino-prezzi/" rel="nofollow noreferrer" target="_blank">Lavanderia Vecchia Milano</a>
            </td>
            <td>2,50 €</td>
            <td>2,00 €</td>
          </tr>
          <tr>
            <td>
              <a href="https://www.mamaclean.it/i-nostri-prezzi" rel="nofollow noreferrer" target="_blank">MamaClean</a>
            </td>
            <td>2,50 € (solo in pacchetto da 5, non è detto se lavate o solo stirate)</td>
            <td>non pubblicato</td>
          </tr>
          <tr>
            <td>
              <a href="https://www.lavanderiamedeghino.it/listino-prezzi/" rel="nofollow noreferrer" target="_blank">Lavanderia Medeghino</a>
            </td>
            <td>2,90 €</td>
            <td>2,30 €</td>
          </tr>
          <tr>
            <td>
              <a href="https://www.lavanderialamoderna.it/prezzi/" rel="nofollow noreferrer" target="_blank">Lavanderia La Moderna</a>
            </td>
            <td>3,00 € appesa · 3,45 € piegata</td>
            <td>2,45 € · 2,95 €</td>
          </tr>
          <tr>
            <td>
              <a href="https://www.afb-laundry.it/listino/" rel="nofollow noreferrer" target="_blank">AFB Lifestyle Laundry</a>
            </td>
            <td>4,00 €</td>
            <td>2,80 €</td>
          </tr>
          <tr>
            <td>
              <a href="https://www.tintoria-ricciarelli.com/" rel="nofollow noreferrer" target="_blank">Tintoria Ricciarelli</a>,{" "}
              <a href="https://www.lava-stira-ripara.it/" rel="nofollow noreferrer" target="_blank">Lava&amp;Stira&amp;Ripara</a>,{" "}
              <a href="https://www.clickwash.it/" rel="nofollow noreferrer" target="_blank">ClickWash</a>
            </td>
            <td colSpan={2}>non pubblicano nessun prezzo di capo</td>
          </tr>
        </tbody>
      </table>
      <p>
        Da noi la camicia non si paga a capo: <strong>ogni sacchetto comprende fino a 3 camicie
        stirate</strong>, dentro l&apos;abbonamento. Oltre quelle, la camicia va a listino a 3,50 €
        — il prezzo più alto della tabella dopo AFB, e lo scriviamo perché è così.
      </p>

      <h2>Il piumone matrimoniale: da 15 € a 25 €</h2>
      <p>
        Quattro operatori su tredici pubblicano un prezzo dichiaratamente matrimoniale. Tre
        pubblicano una voce «piumone» senza dire la misura, il che a conti fatti non è un prezzo.
      </p>
      <table>
        <thead>
          <tr>
            <th>Operatore</th>
            <th>Matrimoniale sintetico</th>
            <th>Matrimoniale in piuma</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Lavanderia San Gottardo</td>
            <td>15,00 €</td>
            <td>17,00 €</td>
          </tr>
          <tr>
            <td>Lavanderia Medeghino</td>
            <td colSpan={2}>20,00 € («trapunta 2 piazze», sintetica o d&apos;oca)</td>
          </tr>
          <tr>
            <td>
              <a href="https://masterclean.it/listino-prezzi/" rel="nofollow noreferrer" target="_blank">Master Clean</a> (Opera)
            </td>
            <td>20,00 €</td>
            <td>21,00 €</td>
          </tr>
          <tr>
            <td>Lavanderia La Moderna</td>
            <td>20,00 €</td>
            <td>25,00 € (con confezionamento salva spazio)</td>
          </tr>
          <tr>
            <td>WashLoop</td>
            <td>15,40 €</td>
            <td>21,00 €</td>
          </tr>
        </tbody>
      </table>
      <p>
        Attenzione a due righe piccole: il listino di Master Clean stampa nelle intestazioni «+0,50
        € a capo» sul lavaggio ad acqua e «+2,50 € sui capi pregiati», e Lavasecco 5 Stelle avverte
        che sui capi voluminosi «può essere richiesto un piccolo supplemento». In entrambi i casi il
        numero in tabella non è il prezzo finale.
      </p>

      <h2>Il ritiro a domicilio: 4 operatori su 11 non dicono quanto costa</h2>
      <p>
        Qui sta la differenza che cambia il conto, e quasi nessuno la mette in evidenza. Degli
        undici che fanno ritiro a domicilio:
      </p>
      <ul>
        <li>
          <strong>gratis senza soglia</strong>: Tintoria Ricciarelli, Lavanderia Medeghino;
        </li>
        <li>
          <strong>gratis sopra una spesa minima</strong>: Vecchia Milano e San Gottardo sopra 50 €
          (San Gottardo solo in zona Darsena, Navigli, Bocconi), AFB sopra 30 € — sotto, 5 € a
          tratta, cioè fino a 10 € andata e ritorno;
        </li>
        <li>
          <strong>sempre a pagamento</strong>: Lava&amp;Stira&amp;Ripara 5 € a Milano (gratis solo
          per i CAP 20121, 20125 e 20156);{" "}
          <a href="https://www.clickwash.it/scopri-le-domande-frequenti" rel="nofollow noreferrer" target="_blank">ClickWash</a> 8 € totali
          sotto i 40 € di ordine, 4 € sopra, più 2 €/km oltre i 3 km;
        </li>
        <li>
          <strong>non pubblicato</strong>: MamaClean, La Moderna, Lavasecco 5 Stelle, Master Clean.
        </li>
      </ul>
      <p>
        Il caso che vale la pena raccontare è MamaClean: la pagina si chiama «I nostri prezzi» e ha
        una sezione intitolata «Prezzi chiari», ma contiene quattro numeri in tutto. Il listino vero
        è dentro l&apos;app, visibile dopo la registrazione. E l&apos;abbonamento «MamaClean Plus»
        promette di azzerare le spese di servizio — spese il cui importo sul sito non è scritto da
        nessuna parte.
      </p>
      <p>
        Dalla parte opposta, ClickWash non pubblica il prezzo di un solo capo ma pubblica i costi di
        consegna fin nel dettaglio dei chilometri. Nessuno dei due ti fa fare il conto intero.
      </p>

      <h2>E la lavanderia a gettoni?</h2>
      <p>
        È l&apos;alternativa vera per chi lava molto e stira poco.{" "}
        <a href="https://www.allwashlavanderia.it/lavaggio-self-service" rel="nofollow noreferrer" target="_blank">AllWash</a>, in via
        Mercantini, pubblica kg e prezzo insieme: lavaggio 8 kg 4,00 € e asciugatura 4,00 €, cioè{" "}
        <strong>8 € per un ciclo completo</strong>; 18 kg sono 15 € in tutto.
      </p>
      <p>
        Bloomest, che ha due sedi a Milano, pubblica «S», «M» e «L» senza dire i chilogrammi — e i
        prezzi fra le sue due sedi milanesi non coincidono: la lavatrice piccola costa{" "}
        <a href="https://milanocertosa.bloomest.it/it/prezzi.php" rel="nofollow noreferrer" target="_blank">4,50 € a Certosa</a> e{" "}
        <a href="https://milanocittastudi.bloomest.it/it/prezzi.php" rel="nofollow noreferrer" target="_blank">6,00 € in Città Studi</a>,
        stessa insegna, stessa città. Senza i kg dichiarati, le due sedi non sono confrontabili
        nemmeno fra loro.
      </p>
      <p>
        Il costo da aggiungere al gettone è il tuo tempo: andata, attesa, ritorno. Un carico con
        asciugatura vuole circa un&apos;ora e mezza sul posto.
      </p>

      <h2>Quindi, quanto costa in un mese?</h2>
      <p>Tre modi di far lavare le stesse cose, con i numeri di questa rilevazione:</p>
      <ul>
        <li>
          <strong>Self-service</strong>: un carico da 8 kg a settimana con asciugatura fa 32 € al
          mese, più il detersivo e circa sei ore della tua vita. Stirare resta a te.
        </li>
        <li>
          <strong>Tintoria a capo</strong>: 5 camicie a settimana a 2,40–3,00 € fanno 48–60 € al
          mese di sole camicie, lavate e stirate. Lenzuola, asciugamani e magliette non sono
          compresi, e il ritiro può costare o chiedere un minimo di spesa.
        </li>
        <li>
          <strong>Abbonamento</strong>: il nostro è 160 € al mese per un sacco a settimana — un
          borsone pieno, lavato, stirato e piegato, con ritiro e riconsegna inclusi — e{" "}
          <Link href="/prezzi">122 € al mese per il solo stiro</Link>.
        </li>
      </ul>
      <p>
        <strong>Quando l&apos;abbonamento non conviene, e lo diciamo noi.</strong> Se in casa vivi
        da solo, hai la lavatrice e stiri due camicie a settimana, 160 € al mese sono troppi: ti
        conviene il self-service, o la tintoria per i capi buoni. L&apos;abbonamento ha senso quando
        la settimana produce un borsone intero <em>e</em> quando lo stiro ti pesa: è lì che il conto
        gira, perché quelle sono le due cose che ti stiamo togliendo insieme.
      </p>

      <h2>Cosa guardare prima di scegliere</h2>
      <ol>
        <li>
          <strong>Il ritiro è compreso o no?</strong> È la voce che cambia il totale e quella che
          più spesso non è scritta.
        </li>
        <li>
          <strong>C&apos;è una spesa minima?</strong> Un ritiro «gratis sopra 50 €» su un ordine da
          15 € è un ritiro a pagamento.
        </li>
        <li>
          <strong>Il prezzo in tabella è finale?</strong> Cerca i supplementi scritti in piccolo
          sulle intestazioni.
        </li>
        <li>
          <strong>Il listino si vede prima di registrarsi?</strong> Se per sapere il prezzo devi
          dare un&apos;email, quello non è un listino.
        </li>
      </ol>

      <p>
        <em>
          Rilevazione del 29 ottobre 2026 su 13 operatori. I prezzi cambiano: ogni voce rimanda alla
          pagina da cui è stata presa, così puoi ricontrollarla. Se trovi un dato che non torna
          più,{" "}
        </em>
        <Link href="/contatti">scrivicelo</Link>
        <em> e lo correggiamo.</em>
      </p>
    </Guida>
  );
}
