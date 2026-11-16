import type { ReactNode } from "react";
import { comSinal, placar } from "@/lib/dominio";
import { dataCurta, type Partida } from "@/lib/consultas";
import { ValePontos } from "./ValePontos";

/** Quanto o rating de um lado mudou nesta partida (só nas confirmadas). */
function Delta({ antes, depois }: { antes: number | null; depois: number | null }) {
  if (antes === null || depois === null) return null;
  const d = Math.round(depois) - Math.round(antes);
  return (
    <span className={`ml-1 font-display font-extrabold tabular-nums ${d < 0 ? "text-[#8a1640]" : "text-[#0b4f49]"}`}>
      {comSinal(d)}
    </span>
  );
}

/**
 * Uma partida: brancas × pretas e o placar. Confirmada: quanto cada um ganhou ou perdeu.
 * Pendente: quanto cada um ganha ou perde em cada resultado.
 */
export function LinhaPartida({ p, children }: { p: Partida; children?: ReactNode }) {
  return (
    <li className="grid gap-2 border-b-2 border-linha py-2 last:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-24 shrink-0 whitespace-nowrap text-base text-tinta-suave">
          {dataCurta(p.played_at ?? p.created_at)}
        </span>
        {/* brancas sempre à esquerda; para leitor de tela, dito por extenso */}
        <span className="min-w-0 flex-1">
          <span className="font-bold">{p.white.nickname}</span>
          <span className="sr-only"> (brancas)</span>
          <Delta antes={p.white_rating_before} depois={p.white_rating_after} />
          <span className="mx-2 rounded-lg bg-fundo px-2 py-0.5 font-display font-extrabold tabular-nums">
            {placar(Number(p.white_score))}
          </span>
          <span className="font-bold">{p.black.nickname}</span>
          <span className="sr-only"> (pretas)</span>
          <Delta antes={p.black_rating_before} depois={p.black_rating_after} />
        </span>
        {children}
      </div>
      {p.status === "pendente" && <ValePontos a={p.white} b={p.black} />}
    </li>
  );
}
