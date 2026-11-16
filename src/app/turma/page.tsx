import type { Metadata } from "next";
import Link from "next/link";
import { responderPartida } from "../acoes";
import { Aviso } from "@/components/Aviso";
import { QuadroRanking } from "@/components/QuadroRanking";
import { ValePontos } from "@/components/ValePontos";
import { alunosDaTurma, partidas, type Partida } from "@/lib/consultas";
import { ratingNaTela } from "@/lib/ranking";
import { exigirAluno } from "@/lib/sessao";

export const metadata: Metadata = { title: "Minha turma" };

/** "ganhou de você", "empatou com você"… do ponto de vista de quem lê. */
function resumo(p: Partida, euId: string) {
  const souBrancas = p.white_id === euId;
  const outro = (souBrancas ? p.black : p.white)?.nickname ?? "Colega";
  const meuPlacar = souBrancas ? Number(p.white_score) : 1 - Number(p.white_score);
  const cor = souBrancas ? "você de brancas" : "você de pretas";
  return { outro, cor, meuPlacar };
}

export default async function Turma({ searchParams }: PageProps<"/turma">) {
  const eu = await exigirAluno();
  const [sp, alunos, pendentes] = await Promise.all([
    searchParams,
    alunosDaTurma(eu.classId),
    partidas({ alunoId: eu.id, status: "pendente" }),
  ]);
  const meu = alunos.find((a) => a.id === eu.id);

  return (
    <div className="grid gap-5">
      <Aviso ok={sp.ok} erro={sp.erro} />
      <section className="cartao flex flex-wrap items-center justify-between gap-4 bg-roxo text-white">
        <div>
          <h1 className="text-3xl">Oi, {eu.apelido}!</h1>
          {meu && (
            <p className="text-xl">
              Seu rating: <strong className="font-display text-3xl text-sol">{ratingNaTela(meu)}</strong>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/registrar" className="btn btn-sol">
            Registrar partida
          </Link>
          <Link href={`/aluno/${eu.id}`} className="btn btn-claro">
            Minha página
          </Link>
        </div>
      </section>

      {pendentes.length > 0 && (
        <section className="cartao border-sol" aria-labelledby="t-pendentes">
          <h2 id="t-pendentes" className="mb-2 text-2xl">
            Partidas para confirmar
          </h2>
          <ul className="grid gap-3">
            {pendentes.map((p) => {
              const { outro, cor, meuPlacar } = resumo(p, eu.id);
              const fuiEu = p.reported_by === eu.id;
              const frase = fuiEu
                ? `Esperando ${outro} confirmar (${meuPlacar === 1 ? "você ganhou" : meuPlacar === 0 ? "você perdeu" : "empate"}, ${cor}).`
                : `${outro} disse que ${meuPlacar === 1 ? "você ganhou" : meuPlacar === 0 ? "ganhou de você" : "vocês empataram"} (${cor}). Foi isso?`;
              return (
                <li key={p.id} className="rounded-2xl bg-fundo p-3">
                  <p className="mb-2 font-bold">{frase}</p>
                  <div className="mb-3 rounded-2xl bg-papel p-3">
                    <ValePontos a={p.white} b={p.black} />
                  </div>
                  <form action={responderPartida} className="flex flex-wrap gap-3">
                    <input type="hidden" name="partida" value={p.id} />
                    {fuiEu ? (
                      <button name="resposta" value="nao" className="btn btn-claro btn-p">
                        Cancelar
                      </button>
                    ) : (
                      <>
                        <button name="resposta" value="sim" className="btn btn-p">
                          Foi isso!
                        </button>
                        <button name="resposta" value="nao" className="btn btn-claro btn-p">
                          Não foi assim
                        </button>
                      </>
                    )}
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <QuadroRanking alunos={alunos} euId={eu.id} />
    </div>
  );
}
