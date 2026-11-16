import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { entrarAluno } from "../acoes";
import { Aviso } from "@/components/Aviso";
import { Enviar } from "@/components/Enviar";
import { cidades, locaisDaCidade } from "@/lib/consultas";
import { PIN_DIGITOS, destinoSeguro } from "@/lib/dominio";
import { getViewer } from "@/lib/sessao";

export const metadata: Metadata = { title: "Entrar" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const CARTAO = "cartao flex min-h-24 items-center justify-center text-center font-display text-2xl font-extrabold hover:border-roxo";

/** Cidade → local → PIN. Com uma cidade só, ou um local só, o passo é pulado. */
export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = destinoSeguro(um(sp.next));
  if ((await getViewer())?.tipo === "aluno") redirect(next);
  const link = (qs: string) => `/entrar?${qs}${qs && "&"}next=${encodeURIComponent(next)}`;

  const todas = await cidades();
  const cidade = todas.find((c) => c.id === um(sp.cidade)) ?? (todas.length === 1 ? todas[0] : undefined);
  const locais = cidade ? await locaisDaCidade(cidade.id) : [];
  const local = locais.find((l) => l.id === um(sp.local)) ?? (locais.length === 1 ? locais[0] : undefined);
  // para onde o "fechar" do PIN volta: a lista de locais, ou a de cidades se o local foi pulado
  const fechar = link(cidade && locais.length > 1 ? `cidade=${cidade.id}` : "");

  return (
    <div className="grid gap-4">
      {!cidade || locais.length <= 1 ? (
        <>
          <h1 className="text-3xl">Qual é a sua cidade?</h1>
          {todas.length === 0 && <p className="cartao">Ainda não há cidades cadastradas. Chame o professor!</p>}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {todas.map((c) => (
              <li key={c.id}>
                <Link href={link(`cidade=${c.id}`)} className={CARTAO}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
          {cidade && locais.length === 0 && (
            <p className="cartao">{cidade.name} ainda não tem nenhum local. Chame o professor!</p>
          )}
        </>
      ) : (
        <>
          <div>
            <p className="font-bold text-tinta-suave">{cidade.name}</p>
            <h1 className="text-3xl">Onde você joga?</h1>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {locais.map((l) => (
              <li key={l.id}>
                <Link href={link(`cidade=${cidade.id}&local=${l.id}`)} className={CARTAO}>
                  {l.name}
                </Link>
              </li>
            ))}
          </ul>
          {todas.length > 1 && (
            <Link href={link("")} className="min-h-11 content-center font-bold text-roxo-escuro underline">
              ← Outra cidade
            </Link>
          )}
        </>
      )}

      {cidade && local && (
        // Janela do PIN por cima da lista. É só HTML: o "fechar" é um link.
        <div className="fixed inset-0 z-20 grid place-items-center bg-tinta/60 p-4">
          <form
            action={entrarAluno}
            role="dialog"
            aria-modal="true"
            aria-labelledby="t-pin"
            className="cartao relative grid w-full max-w-md gap-4 text-center shadow-2xl"
          >
            <Link href={fechar} aria-label="Fechar" className="absolute right-2 top-2 grid size-11 place-items-center text-2xl font-bold">
              ×
            </Link>
            <div>
              <p className="font-bold text-tinta-suave">
                {cidade.name} · {local.name}
              </p>
              <h2 id="t-pin" className="text-3xl">
                Digite o seu PIN
              </h2>
            </div>
            <Aviso erro={sp.erro} />
            <label className="grid gap-1 font-bold">
              PIN de {PIN_DIGITOS} números
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                pattern={`\\d{${PIN_DIGITOS}}`}
                maxLength={PIN_DIGITOS}
                required
                autoFocus
                autoComplete="off"
                className="campo text-center font-display text-4xl tracking-[0.5em]"
              />
            </label>
            <input type="hidden" name="cidade" value={cidade.id} />
            <input type="hidden" name="local" value={local.id} />
            <input type="hidden" name="next" value={next} />
            <Enviar>Entrar</Enviar>
          </form>
        </div>
      )}
    </div>
  );
}
