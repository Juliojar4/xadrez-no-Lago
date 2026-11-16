import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { alternarAtivo, criarLocal } from "../acoes";
import { Avatar } from "@/components/Avatar";
import { Aviso } from "@/components/Aviso";
import { Enviar } from "@/components/Enviar";
import { NovoAluno, NovoPin } from "@/components/FormulariosProfessor";
import { localDaVez, todosOsAlunos } from "@/lib/consultas";
import { NIVEIS } from "@/lib/dominio";
import { ratingNaTela } from "@/lib/ranking";
import { exigirProfessor } from "@/lib/sessao";

export const metadata: Metadata = { title: "Minha cidade" };

export default async function Professor({ searchParams }: PageProps<"/professor">) {
  const [prof, sp] = await Promise.all([exigirProfessor(), searchParams]);
  const { locais, atual } = await localDaVez(prof.id, sp.local);

  const formLocal = (
    <form action={criarLocal} className="cartao grid gap-3">
      <h2 className="text-2xl">Novo local</h2>
      <p className="text-base text-tinta-suave">
        Um local é uma turma (escola, clube, projeto…): tem os seus alunos e o seu ranking.
      </p>
      <label className="grid gap-1 font-bold">
        Nome do local
        <input name="nome" required minLength={2} maxLength={60} autoComplete="off" className="campo" />
      </label>
      <div>
        <Enviar>Criar local</Enviar>
      </div>
    </form>
  );

  if (!atual)
    return (
      <div className="grid gap-5">
        <h1 className="text-3xl">{prof.nome}</h1>
        <Aviso ok={sp.ok} erro={sp.erro} />
        <p className="cartao">Comece criando o primeiro local da cidade. Depois é só cadastrar os alunos.</p>
        {formLocal}
      </div>
    );

  const alunos = (await todosOsAlunos(atual.id)).sort((a, b) => Number(b.active) - Number(a.active) || b.rating - a.rating);
  // O QR da mesa leva o aluno direto para "registrar partida" (passando pelo PIN).
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/entrar?cidade=${prof.id}&local=${atual.id}&next=/registrar`;
  const qr = await QRCode.toString(link, { type: "svg", margin: 1 });

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">{prof.nome}</h1>
        <Link href={`/professor/partidas?local=${atual.id}`} className="btn btn-sol">
          Registrar partidas
        </Link>
      </div>
      <Aviso ok={sp.ok} erro={sp.erro} />

      {locais.length > 1 && (
        <nav aria-label="Locais" className="flex flex-wrap gap-2">
          {locais.map((l) => (
            <Link
              key={l.id}
              href={`/professor?local=${l.id}`}
              aria-current={l.id === atual.id ? "page" : undefined}
              className={`btn btn-p ${l.id === atual.id ? "" : "btn-claro"}`}
            >
              {l.name}
            </Link>
          ))}
        </nav>
      )}

      <section className="cartao flex flex-wrap items-center gap-5" aria-labelledby="t-local">
        {/* SVG gerado no servidor pela lib qrcode a partir de um link nosso */}
        <div className="w-36 shrink-0" role="img" aria-label="QR code para registrar partida" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="min-w-0 flex-1">
          <h2 id="t-local" className="font-display text-4xl font-extrabold text-roxo">
            {atual.name}
          </h2>
          <p className="text-base text-tinta-suave">
            Os alunos entram escolhendo a cidade, o local e digitando o PIN. Imprima o QR e deixe nas mesas: ele abre
            direto o PIN deste local e, depois, o registro de partida.
          </p>
        </div>
      </section>

      <section className="cartao" aria-labelledby="t-alunos">
        <h2 id="t-alunos" className="mb-2 text-2xl">
          Alunos ({alunos.filter((a) => a.active).length})
        </h2>
        {alunos.length === 0 && <p className="text-tinta-suave">Cadastre o primeiro aluno aqui embaixo.</p>}
        <ul>
          {alunos.map((a) => (
            <li key={a.id} className={`border-b-2 border-linha py-2 last:border-0 ${a.active ? "" : "opacity-60"}`}>
              <details>
                <summary className="flex min-h-12 cursor-pointer items-center gap-3">
                  <Avatar chave={a.avatar} tamanho={40} />
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {a.nickname}
                    {!a.active && " (desativado)"}
                  </span>
                  <span className="text-base text-tinta-suave max-sm:hidden">
                    {NIVEIS[a.initial_level].rotulo} · {a.games_played} partidas
                  </span>
                  <span className="font-display text-xl font-extrabold tabular-nums">{ratingNaTela(a)}</span>
                </summary>
                <div className="grid gap-3 rounded-2xl bg-fundo p-3">
                  <NovoPin alunoId={a.id} />
                  <div className="flex flex-wrap gap-3">
                    <Link href={`/aluno/${a.id}`} className="btn btn-claro btn-p">
                      Ver página
                    </Link>
                    <form action={alternarAtivo}>
                      <input type="hidden" name="aluno" value={a.id} />
                      <input type="hidden" name="ativo" value={a.active ? "nao" : "sim"} />
                      <button className="btn btn-claro btn-p">{a.active ? "Desativar aluno" : "Reativar aluno"}</button>
                    </form>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="cartao" aria-labelledby="t-novo">
        <h2 id="t-novo" className="mb-3 text-2xl">
          Cadastrar aluno em {atual.name}
        </h2>
        <NovoAluno localId={atual.id} />
      </section>

      {formLocal}
    </div>
  );
}
