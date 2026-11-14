import type { ReactNode } from "react";
import { comSinal, placar } from "@/lib/dominio";
import { dataCurta, type Partida } from "@/lib/consultas";

/** Uma partida: brancas × pretas, placar e (se `focoId`) quanto o rating daquele aluno mudou. */
export function LinhaPartida({ p, focoId, children }: { p: Partida; focoId?: string; children?: ReactNode }) {
  const souBrancas = focoId === p.white_id;
  const antes = souBrancas ? p.white_rating_before : p.black_rating_before;
  const depois = souBrancas ? p.white_rating_after : p.black_rating_after;
  const delta = focoId && antes !== null && depois !== null ? Math.round(depois) - Math.round(antes) : null;
  const nome = (a: { nickname: string } | null) => a?.nickname ?? "Colega";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-linha py-2 last:border-0">
      <span className="w-24 shrink-0 whitespace-nowrap text-base text-tinta-suave">
        {dataCurta(p.played_at ?? p.created_at)}
      </span>
      {/* brancas sempre à esquerda; para leitor de tela, dito por extenso */}
      <span className="min-w-0 flex-1">
        <span className="font-bold">{nome(p.white)}</span>
        <span className="sr-only"> (brancas)</span>
        <span className="mx-2 rounded-lg bg-fundo px-2 py-0.5 font-display font-extrabold tabular-nums">
          {placar(Number(p.white_score))}
        </span>
        <span className="font-bold">{nome(p.black)}</span>
        <span className="sr-only"> (pretas)</span>
      </span>
      {delta !== null && (
        <span className={`font-display text-xl font-extrabold tabular-nums ${delta < 0 ? "text-coral" : "text-menta"}`}>
          {comSinal(delta)}
        </span>
      )}
      {children}
    </li>
  );
}
