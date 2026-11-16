import { comSinal } from "@/lib/dominio";
import { previewDeltas } from "@/lib/glicko";
import { paraPlayer, type Jogador } from "@/lib/rating";
import { Avatar } from "./Avatar";

export type Lado = Jogador & { nickname: string; avatar: string };

/**
 * Quanto cada um dos dois ganha ou perde de rating se vencer, empatar ou perder.
 * Calculado com o mesmo glicko.ts que grava o resultado, com o rating de AGORA.
 * Sem "use client": serve tanto para página do servidor quanto para componente de cliente.
 */
export function ValePontos({ a, b, rotulo = "Quanto vale esta partida" }: { a: Lado; b: Lado; rotulo?: string }) {
  const agora = new Date();
  const linhas = [
    { quem: a, d: previewDeltas(paraPlayer(a), paraPlayer(b), agora) },
    { quem: b, d: previewDeltas(paraPlayer(b), paraPlayer(a), agora) },
  ];
  return (
    <table className="w-full text-center tabular-nums">
      <caption className="mb-1 text-left text-base font-bold text-tinta-suave">{rotulo}</caption>
      <thead className="text-sm text-tinta-suave">
        <tr>
          <th scope="col" className="sr-only">
            Aluno
          </th>
          <th scope="col" className="font-bold">
            Se ganhar
          </th>
          <th scope="col" className="font-bold">
            Se empatar
          </th>
          <th scope="col" className="font-bold">
            Se perder
          </th>
        </tr>
      </thead>
      <tbody>
        {linhas.map(({ quem, d }) => (
          <tr key={quem.id} className="border-t-2 border-linha">
            <th scope="row" className="py-1.5 pr-2 text-left">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar chave={quem.avatar} tamanho={28} />
                <span className="truncate">{quem.nickname}</span>
              </span>
            </th>
            <td className="font-display text-xl font-extrabold text-[#0b4f49]">{comSinal(d.win)}</td>
            <td className="font-display text-xl font-extrabold">{comSinal(d.draw)}</td>
            <td className="font-display text-xl font-extrabold text-[#8a1640]">{comSinal(d.loss)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
