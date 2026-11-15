/**
 * Ponte entre as linhas do banco e o glicko.ts. Tudo aqui é puro (sem banco),
 * para dar para testar e para recalcular a turma inteira a qualquer momento.
 * Só roda no servidor: nenhum componente de cliente importa este arquivo.
 */
import { DEFAULT_CONFIG, newPlayer, recordGame, type Player, type Result } from "./glicko";
import { NIVEIS, type Nivel } from "./dominio";

// `type` (e não interface) para poder ir direto como parâmetros nomeados do SQLite.
export type Jogador = {
  id: string;
  rating: number;
  rd: number;
  last_played_at: string | null;
  games_played: number;
};

export const paraPlayer = (j: Jogador): Player => ({
  id: j.id,
  rating: j.rating,
  rd: j.rd,
  lastPlayedAt: j.last_played_at ? new Date(j.last_played_at) : null,
  gamesPlayed: j.games_played,
});

const deJogador = (p: Player): Jogador => ({
  id: p.id,
  rating: p.rating,
  rd: p.rd,
  last_played_at: p.lastPlayedAt?.toISOString() ?? null,
  games_played: p.gamesPlayed,
});

export const jogadorInicial = (id: string, nivel: Nivel): Jogador =>
  deJogador(newPlayer(id, DEFAULT_CONFIG, NIVEIS[nivel].rating));

/** Colunas de auditoria gravadas em `games` + o novo estado dos dois alunos. */
export function calcularPartida(white: Jogador, black: Jogador, whiteScore: Result, playedAt: Date) {
  const o = recordGame(paraPlayer(white), paraPlayer(black), whiteScore, playedAt);
  return {
    white: deJogador(o.a),
    black: deJogador(o.b),
    deltaWhite: o.deltaA,
    deltaBlack: o.deltaB,
    colunas: {
      white_rating_before: white.rating,
      white_rd_before: white.rd,
      white_rating_after: o.a.rating,
      white_rd_after: o.a.rd,
      black_rating_before: black.rating,
      black_rd_before: black.rd,
      black_rating_after: o.b.rating,
      black_rd_after: o.b.rd,
    },
  };
}

export interface PartidaReplay {
  id: string;
  white_id: string;
  black_id: string;
  white_score: number;
  played_at: string;
}

/** Refaz o rating da turma do zero, na ordem em que as partidas foram aplicadas. */
export function replay(alunos: { id: string; initial_level: Nivel }[], partidas: PartidaReplay[]) {
  const estado = new Map(alunos.map((a) => [a.id, jogadorInicial(a.id, a.initial_level)]));
  const ordenadas = [...partidas].sort((x, y) => x.played_at.localeCompare(y.played_at));
  const recalculadas = ordenadas.map((p) => {
    const white = estado.get(p.white_id);
    const black = estado.get(p.black_id);
    if (!white || !black) throw new Error(`partida ${p.id} com aluno fora da turma`);
    const r = calcularPartida(white, black, p.white_score as Result, new Date(p.played_at));
    estado.set(white.id, r.white);
    estado.set(black.id, r.black);
    return { id: p.id, ...r.colunas };
  });
  return { alunos: [...estado.values()], partidas: recalculadas };
}
