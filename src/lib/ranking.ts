import { buildLeaderboard, isProvisional } from "./glicko";
import { paraPlayer, type Jogador } from "./rating";

export type AlunoLista = Jogador & { nickname: string; avatar: string };

/** "812" ou "812?" enquanto o rating for provisório (RD > 110). */
export const ratingNaTela = (a: Jogador, agora = new Date()) =>
  `${Math.round(a.rating)}${isProvisional(paraPlayer(a), agora) ? "?" : ""}`;

/**
 * Separa a turma em: ranking principal, Novatos (provisórios) e quem está
 * parado há mais de 30 dias (o glicko.ts tira do ranking; aqui só não deixamos sumir).
 */
export function montarRanking(alunos: AlunoLista[], agora = new Date()) {
  const porId = new Map(alunos.map((a) => [a.id, a]));
  const { ranked, newcomers } = buildLeaderboard(alunos.map(paraPlayer), agora);
  const listados = new Set([...ranked, ...newcomers].map((x) => x.id));
  return {
    ranking: ranked.map((r) => ({ posicao: r.position, rating: String(r.rating), aluno: porId.get(r.id)! })),
    novatos: newcomers
      .map((n) => ({ rating: n.rating, aluno: porId.get(n.id)! }))
      .sort((x, y) => y.aluno.rating - x.aluno.rating),
    parados: alunos.filter((a) => !listados.has(a.id)),
  };
}
