import Link from "next/link";
import { Avatar } from "./Avatar";
import { Surgir } from "./Movimento";
import { montarRanking, ratingNaTela, type AlunoLista } from "@/lib/ranking";

function Linha({ aluno, rating, posicao, eu }: { aluno: AlunoLista; rating: string; posicao?: number; eu: boolean }) {
  return (
    <Link
      href={`/aluno/${aluno.id}`}
      className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-3 py-2 ${
        eu ? "border-roxo bg-[#ece4ff]" : "border-transparent hover:border-linha"
      }`}
    >
      {posicao !== undefined && (
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-full font-display font-extrabold ${
            posicao === 1 ? "bg-sol" : "bg-fundo"
          }`}
        >
          {posicao}º
        </span>
      )}
      <Avatar chave={aluno.avatar} tamanho={40} />
      <span className="min-w-0 flex-1 truncate font-bold">
        {aluno.nickname}
        {eu && <span className="ml-2 text-base font-normal text-tinta-suave">(você)</span>}
      </span>
      <span className="font-display text-xl font-extrabold tabular-nums">{rating}</span>
    </Link>
  );
}

export function QuadroRanking({ alunos, euId }: { alunos: AlunoLista[]; euId?: string }) {
  const { ranking, novatos, parados } = montarRanking(alunos);
  return (
    <div className="grid gap-5">
      <section className="cartao" aria-labelledby="t-ranking">
        <h2 id="t-ranking" className="mb-2 text-2xl">
          Ranking da turma
        </h2>
        {ranking.length === 0 ? (
          <p className="text-tinta-suave">
            Ainda não tem ninguém aqui. Quem joga bastante sai dos Novatos e entra no ranking!
          </p>
        ) : (
          <ol className="grid gap-1">
            {ranking.map((r, i) => (
              <li key={r.aluno.id}>
                <Surgir ordem={i}>
                  <Linha aluno={r.aluno} rating={r.rating} posicao={r.posicao} eu={r.aluno.id === euId} />
                </Surgir>
              </li>
            ))}
          </ol>
        )}
      </section>

      {novatos.length > 0 && (
        <section className="cartao" aria-labelledby="t-novatos">
          <h2 id="t-novatos" className="text-2xl">
            Novatos
          </h2>
          <p className="mb-2 text-base text-tinta-suave">
            O &quot;?&quot; quer dizer que o rating ainda está se ajustando. Jogue mais partidas para ele firmar.
          </p>
          <ul className="grid gap-1">
            {novatos.map((n) => (
              <li key={n.aluno.id}>
                <Linha aluno={n.aluno} rating={n.rating} eu={n.aluno.id === euId} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {parados.length > 0 && (
        <section className="cartao" aria-labelledby="t-parados">
          <h2 id="t-parados" className="text-2xl">
            Faz tempo que não jogam
          </h2>
          <p className="mb-2 text-base text-tinta-suave">É só jogar uma partida para voltar ao ranking.</p>
          <ul className="grid gap-1">
            {parados.map((a) => (
              <li key={a.id}>
                <Linha aluno={a} rating={ratingNaTela(a)} eu={a.id === euId} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
