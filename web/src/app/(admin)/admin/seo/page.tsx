import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { BottoneInvio } from "@/components/ui/BottoneInvio";
import { createServiceClient } from "@/lib/supabase/server";
import { cambiaStatoSeo, annotaSeo, aggiungiSeo } from "@/lib/actions/seo-task";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Il cantiere SEO: quello che manca per farsi trovare, in ordine di peso.
 *
 *  Non è un doppione di `/admin/crescita`. Quella pagina spiega *perché* certe
 *  cose contano e resta ferma; questa tiene i *lavori*, e cambia man mano che
 *  si fanno. La differenza pratica: lì si va a leggere una volta, qui si torna
 *  il lunedì.
 *
 *  Tre scelte che vale la pena ricordare:
 *
 *  1. In cima c'è **cosa aspetta Simone**. Otto voci su ventinove richiedono un
 *     account o una decisione commerciale che nessun altro può prendere: se
 *     restano sparse nell'elenco, il resto della squadra le legge, le salta e
 *     le dimentica. Qui si vedono per prime e si vede quante sono.
 *
 *  2. Ogni lavoro porta con sé **dove si controlla**. Un intervento SEO senza il
 *     suo posto di verifica è un intervento su cui, fra due mesi, nessuno saprà
 *     dire se è servito — e si rifà uguale.
 *
 *  3. Niente «elimina». Una voce che non serve più si mette a «non serve» col
 *     resto del testo intatto: fra sei mesi, quando qualcuno riproporrà la
 *     stessa cosa, qui c'è scritto che l'avevamo già valutata. */

type Task = {
  id: string;
  titolo: string;
  perche: string | null;
  come: string | null;
  dove: string | null;
  categoria: string;
  priorita: string;
  stato: string;
  decide_simone: boolean;
  nota: string | null;
  sort: number;
  fatto_at: string | null;
};

const CATEGORIA_NOME: Record<string, { nome: string; sub: string }> = {
  indicizzazione: {
    nome: "Farsi trovare, prima di tutto",
    sub: "Finché una pagina non è nell'indice di Google non esiste: nessun contenuto la salva.",
  },
  locale: {
    nome: "Google Maps e la scheda",
    sub: "Per «lavanderia a domicilio milano» il primo blocco di risultati è la mappa, non i siti.",
  },
  contenuti: {
    nome: "Pagine e testi",
    sub: "Quello che si può scrivere per intercettare chi cerca — e quello che oggi si contraddice.",
  },
  fiducia: {
    nome: "Chi siamo e perché fidarsi",
    sub: "Un servizio a cui consegni i vestiti di casa senza sapere chi è non si sceglie.",
  },
  tecnico: {
    nome: "Lavori sul sito",
    sub: "Piccoli, veloci, nessuno sposta da solo il traffico. Tolgono rumore.",
  },
  misura: {
    nome: "Come si controlla",
    sub: "Senza un posto fisso dove guardare, ogni intervento resta un'opinione.",
  },
};

const ORDINE_CATEGORIE = ["indicizzazione", "locale", "contenuti", "fiducia", "tecnico", "misura"] as const;

const PRIO_TONO: Record<string, string> = {
  alta: "bg-[#C0392B]/12 text-[#C0392B]",
  media: "bg-[#C9881F]/15 text-[#C9881F]",
  bassa: "bg-navy/10 text-navy",
};

const STATO_TONO: Record<string, string> = {
  da_fare: "bg-navy/8 text-muted",
  in_corso: "bg-blue/12 text-blue",
  fatto: "bg-[#1F8A5B]/15 text-[#1F8A5B]",
  non_serve: "bg-navy/8 text-navy/50",
};

const STATO_NOME: Record<string, string> = {
  da_fare: "da fare",
  in_corso: "in corso",
  fatto: "fatto",
  non_serve: "non serve",
};

/** I tre posti dove si guarda se sta funzionando. Stanno in cima perché la
 *  domanda «e come faccio a saperlo?» arriva prima di qualsiasi lavoro. */
const POSTI = [
  {
    nome: "Google Search Console",
    url: "https://search.google.com/search-console",
    cosa: "Le parole con cui ci trovano, quante volte, e quali pagine Google ha davvero in indice. È la fonte: il resto sono stime.",
  },
  {
    nome: "Scheda Google (Business Profile)",
    url: "https://business.google.com",
    cosa: "Chiamate, richieste di indicazioni, recensioni. Per un servizio a domicilio porta più di tutto il sito messo insieme.",
  },
  {
    nome: "Vercel Analytics",
    url: "https://vercel.com",
    cosa: "Quante visite arrivano e da dove. Oggi non è acceso: sul sito non c'è nessuna analitica.",
  },
];

const campo =
  "mt-1 w-full rounded-[10px] border-2 border-navy/15 bg-white px-3 py-2 text-sm font-medium text-navy outline-none focus:border-blue";

export default async function SeoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; warn?: string }>;
}) {
  const { ok, warn } = await searchParams;

  const svc = createServiceClient();
  const { data } = await svc
    .from("seo_tasks")
    .select("id, titolo, perche, come, dove, categoria, priorita, stato, decide_simone, nota, sort, fatto_at")
    .order("sort", { ascending: true })
    .returns<Task[]>();

  const tutti = data ?? [];
  const aperti = tutti.filter((t) => t.stato === "da_fare" || t.stato === "in_corso");
  const fatti = tutti.filter((t) => t.stato === "fatto");
  const diSimone = aperti.filter((t) => t.decide_simone);

  return (
    <div className="space-y-5">
      <PageTitle
        kicker="Crescita"
        title="Cantiere SEO"
        sub={`${aperti.length} ${aperti.length === 1 ? "lavoro aperto" : "lavori aperti"} · ${fatti.length} ${
          fatti.length === 1 ? "fatto" : "fatti"
        }${diSimone.length ? ` · ${diSimone.length} aspettano te` : ""}`}
      />

      {ok && (
        <p className="rounded-[14px] bg-[#1F8A5B]/12 px-4 py-3 text-sm font-bold text-[#1F8A5B]">{ok}</p>
      )}
      {warn && (
        <p className="rounded-[14px] bg-[#C0392B]/12 px-4 py-3 text-sm font-bold text-[#C0392B]">{warn}</p>
      )}

      <Card>
        <h2 className="font-display text-lg font-black text-navy">Dove si guarda</h2>
        <p className="mt-1 text-sm font-medium leading-relaxed text-muted">
          Il traffico organico non si vede dal pannello: si vede in questi tre posti. Il primo è l&apos;unico che dice
          la verità su che cosa Google ha in indice e con quali parole ci trova.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {POSTI.map((p) => (
            <li key={p.nome} className="rounded-[14px] border-2 border-navy/10 bg-ice/40 p-4">
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="font-display text-sm font-extrabold text-blue hover:underline"
              >
                {p.nome} →
              </a>
              <p className="mt-1.5 text-xs font-medium leading-relaxed text-muted">{p.cosa}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs font-semibold text-muted">
          Il perché di ogni cosa — e la parte social, che qui non c&apos;è — sta in{" "}
          <Link href="/admin/crescita" className="text-blue hover:underline">
            Crescita
          </Link>
          .
        </p>
      </Card>

      {diSimone.length > 0 && (
        <Card className="border-2 border-[#C9881F]/35">
          <h2 className="font-display text-lg font-black text-navy">Aspettano te</h2>
          <p className="mt-1 text-sm font-medium leading-relaxed text-muted">
            Servono un account, una password o una decisione commerciale: nessuno può farle al posto tuo. Finché
            restano ferme, buona parte del resto dell&apos;elenco non produce niente.
          </p>
          <ul className="mt-4 space-y-2">
            {diSimone.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy">
                <span className={`rounded-full px-2 py-0.5 font-display text-[11px] font-extrabold ${PRIO_TONO[t.priorita]}`}>
                  {t.priorita}
                </span>
                {t.titolo}
                {t.dove && <span className="text-xs font-medium text-muted">· {t.dove}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {ORDINE_CATEGORIE.map((cat) => {
        const righe = tutti.filter((t) => t.categoria === cat);
        if (!righe.length) return null;
        const meta = CATEGORIA_NOME[cat];
        return (
          <Card key={cat}>
            <h2 className="font-display text-lg font-black text-navy">{meta.nome}</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{meta.sub}</p>

            <ul className="mt-4 space-y-3">
              {righe.map((t) => {
                const chiuso = t.stato === "fatto" || t.stato === "non_serve";
                return (
                  <li
                    key={t.id}
                    className={`rounded-[14px] border-2 p-4 ${
                      chiuso ? "border-navy/8 bg-ice/30" : "border-navy/12 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 font-display text-[11px] font-extrabold ${PRIO_TONO[t.priorita]}`}
                      >
                        {t.priorita}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-display text-[11px] font-extrabold ${STATO_TONO[t.stato]}`}
                      >
                        {STATO_NOME[t.stato]}
                        {t.fatto_at ? ` il ${fmtDate(t.fatto_at)}` : ""}
                      </span>
                      {t.decide_simone && !chiuso && (
                        <span className="rounded-full bg-[#C9881F]/15 px-2 py-0.5 font-display text-[11px] font-extrabold text-[#C9881F]">
                          solo Simone
                        </span>
                      )}
                      <h3
                        className={`w-full font-display text-base font-extrabold ${
                          chiuso ? "text-navy/45 line-through" : "text-navy"
                        }`}
                      >
                        {t.titolo}
                      </h3>
                    </div>

                    {t.perche && (
                      <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{t.perche}</p>
                    )}

                    {(t.come || t.dove) && (
                      <details className="mt-2">
                        <summary className="cursor-pointer font-display text-xs font-extrabold text-blue">
                          Come si fa
                        </summary>
                        {t.come && (
                          <p className="mt-2 whitespace-pre-line text-sm font-medium leading-relaxed text-navy">
                            {t.come}
                          </p>
                        )}
                        {t.dove && (
                          <p className="mt-2 text-xs font-semibold text-muted">Si controlla qui: {t.dove}</p>
                        )}
                      </details>
                    )}

                    {t.nota && (
                      <p className="mt-2 rounded-[10px] bg-ice/60 px-3 py-2 text-xs font-semibold text-navy">
                        {t.nota}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {t.stato !== "in_corso" && !chiuso && (
                        <form action={cambiaStatoSeo}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="stato" value="in_corso" />
                          <BottoneInvio className="rounded-full border-2 border-navy px-3 py-1 font-display text-xs font-extrabold text-navy">
                            Ci sto lavorando
                          </BottoneInvio>
                        </form>
                      )}
                      {t.stato !== "fatto" && (
                        <form action={cambiaStatoSeo}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="stato" value="fatto" />
                          <BottoneInvio className="rounded-full bg-blue px-3 py-1 font-display text-xs font-extrabold text-white">
                            Fatto
                          </BottoneInvio>
                        </form>
                      )}
                      {!chiuso && (
                        <form action={cambiaStatoSeo}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="stato" value="non_serve" />
                          <BottoneInvio className="font-display text-xs font-bold text-muted hover:underline">
                            Non serve
                          </BottoneInvio>
                        </form>
                      )}
                      {chiuso && (
                        <form action={cambiaStatoSeo}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="stato" value="da_fare" />
                          <BottoneInvio className="font-display text-xs font-bold text-muted hover:underline">
                            Riaprila
                          </BottoneInvio>
                        </form>
                      )}

                      <form action={annotaSeo} className="flex flex-1 items-center gap-2">
                        <input type="hidden" name="id" value={t.id} />
                        <input
                          name="nota"
                          defaultValue={t.nota ?? ""}
                          placeholder="Nota: dove sei arrivato, il link, perché sei fermo"
                          className="min-w-[180px] flex-1 rounded-full border-2 border-navy/12 bg-white px-3 py-1 text-xs font-medium text-navy outline-none focus:border-blue"
                        />
                        <BottoneInvio className="font-display text-xs font-bold text-blue hover:underline">
                          Salva
                        </BottoneInvio>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}

      <Card>
        <h2 className="font-display text-lg font-black text-navy">Aggiungi una voce</h2>
        <p className="mt-1 text-sm font-medium leading-relaxed text-muted">
          Quello che viene in mente fuori da qui si perde. Il titolo basta: il resto si scrive quando si sa.
        </p>
        <form action={aggiungiSeo} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <label className="text-xs font-bold text-muted">
            Che cosa c&apos;è da fare
            <input name="titolo" required className={campo} placeholder="es. Pagina per gli uffici di Tortona" />
          </label>
          <label className="text-xs font-bold text-muted">
            Dove
            <select name="categoria" defaultValue="contenuti" className={campo}>
              {ORDINE_CATEGORIE.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_NOME[c].nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-muted">
            Priorità
            <select name="priorita" defaultValue="media" className={campo}>
              <option value="alta">alta</option>
              <option value="media">media</option>
              <option value="bassa">bassa</option>
            </select>
          </label>
          <BottoneInvio className="h-[42px] rounded-full bg-blue px-5 font-display text-sm font-extrabold text-white">
            Aggiungi
          </BottoneInvio>
          <label className="text-xs font-bold text-muted sm:col-span-4">
            Perché conta (facoltativo)
            <input name="perche" className={campo} placeholder="La riga che fra tre mesi spiega perché non è burocrazia" />
          </label>
        </form>
      </Card>
    </div>
  );
}
