import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { GraficoRating } from "@/components/GraficoRating";
import { LinhaPartida } from "@/components/LinhaPartida";
import { alunoPorId, partidas } from "@/lib/consultas";
import { NIVEIS } from "@/lib/dominio";
import { ratingNaTela } from "@/lib/ranking";
import { getViewer, inicioDe } from "@/lib/sessao";

export const metadata: Metadata = { title: "Página do aluno" };

export default async function PaginaAluno({ params }: PageProps<"/aluno/[id]">) {
  const [{ id }, v] = await Promise.all([params, getViewer()]);
  if (!v || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Qualquer pessoa logada é da turma única (colega ou professor).
  const aluno = await alunoPorId(id);
  if (!aluno) notFound();

  const jogos = await partidas({ alunoId: id, status: "confirmada" }); // mais nova primeiro
  const placarDe = (p: (typeof jogos)[number]) => (p.white_id === id ? Number(p.white_score) : 1 - Number(p.white_score));
  const conta = (s: number) => jogos.filter((p) => placarDe(p) === s).length;
  const cronologico = [...jogos].reverse();
  const pontos = cronologico.length
    ? [
        (cronologico[0].white_id === id ? cronologico[0].white_rating_before : cronologico[0].black_rating_before)!,
        ...cronologico.map((p) => (p.white_id === id ? p.white_rating_after : p.black_rating_after)!),
      ]
    : [];
  const voltar = inicioDe(v);

  return (
    <div className="grid gap-5">
      <Link href={voltar} className="min-h-11 content-center font-bold text-roxo-escuro underline">
        ← Voltar
      </Link>
      <section className="cartao flex flex-wrap items-center gap-4">
        <Avatar chave={aluno.avatar} tamanho={88} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl">{aluno.nickname}</h1>
          <p className="text-tinta-suave">Começou como {NIVEIS[aluno.initial_level].rotulo}</p>
        </div>
        <p className="text-right">
          <span className="block text-base font-bold text-tinta-suave">Rating</span>
          <strong className="font-display text-5xl font-extrabold text-roxo">{ratingNaTela(aluno)}</strong>
        </p>
      </section>

      <dl className="grid grid-cols-4 gap-2 text-center">
        {[
          ["Partidas", jogos.length],
          ["Vitórias", conta(1)],
          ["Empates", conta(0.5)],
          ["Derrotas", conta(0)],
        ].map(([rotulo, n]) => (
          <div key={rotulo} className="cartao px-1 py-3">
            <dd className="font-display text-3xl font-extrabold">{n}</dd>
            <dt className="text-base text-tinta-suave">{rotulo}</dt>
          </div>
        ))}
      </dl>

      <section className="cartao" aria-labelledby="t-grafico">
        <h2 id="t-grafico" className="mb-2 text-2xl">
          Evolução do rating
        </h2>
        <GraficoRating pontos={pontos} />
      </section>

      <section className="cartao" aria-labelledby="t-partidas">
        <h2 id="t-partidas" className="mb-2 text-2xl">
          Últimas partidas
        </h2>
        {jogos.length === 0 ? (
          <p className="text-tinta-suave">Nenhuma partida ainda. Bora jogar a primeira?</p>
        ) : (
          <ul>
            {jogos.slice(0, 15).map((p) => (
              <LinhaPartida key={p.id} p={p} focoId={id} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
