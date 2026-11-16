import "server-only";
import { randomUUID } from "node:crypto";
import { rodar, transacao, um } from "./db";
import type { Result } from "./glicko";
import { calcularPartida, replay, type Jogador, type PartidaReplay } from "./rating";
import type { CodigoMensagem, Nivel } from "./dominio";
import type { Jogo } from "./tipos";

/** Erro esperado; o código vira uma mensagem amigável em MENSAGENS (dominio.ts). */
export class ErroPartida extends Error {
  constructor(public codigo: CodigoMensagem) {
    super(codigo);
  }
}

// Cada fluxo abaixo roda numa transação de escrita: entre ler o rating e gravar o novo,
// ninguém mais escreve. As gravações vão juntas num lote (uma ida ao banco).

const gravarAluno = (j: Jogador) => ({
  sql: "update students set rating = :rating, rd = :rd, last_played_at = :last_played_at, games_played = :games_played where id = :id",
  args: j,
});

const LADOS = ["white", "black"].flatMap((l) => ["rating_before", "rd_before", "rating_after", "rd_after"].map((c) => `${l}_${c}`));
const SET_AUDITORIA = LADOS.map((c) => `${c} = :${c}`).join(", ");

/** Cria a partida como pendente. O rating só muda em `aplicarPartida`. */
export async function criarPartida(p: {
  classId: string;
  whiteId: string;
  blackId: string;
  whiteScore: Result;
  reportedBy: string;
}): Promise<string> {
  if (p.whiteId === p.blackId) throw new ErroPartida("iguais");
  const linha = await um<{ n: number }>(
    "select count(*) n from students where class_id = ? and active = 1 and id in (?, ?)",
    [p.classId, p.whiteId, p.blackId],
  );
  if (linha?.n !== 2) throw new ErroPartida("turma");

  const id = randomUUID();
  await rodar("insert into games (id, class_id, white_id, black_id, white_score, reported_by) values (?, ?, ?, ?, ?, ?)", [
    id,
    p.classId,
    p.whiteId,
    p.blackId,
    p.whiteScore,
    p.reportedBy,
  ]);
  return id;
}

/** Confirma uma partida pendente: calcula o Glicko e grava tudo de uma vez. */
export async function aplicarPartida(gameId: string, confirmedBy: string, playedAt = new Date()) {
  return transacao(async (tx) => {
    const g = (await tx.execute({ sql: "select * from games where id = ?", args: [gameId] })).rows[0] as unknown as
      | Jogo
      | undefined;
    if (g?.status !== "pendente") throw new ErroPartida("resolvida");
    const alunos = (
      await tx.execute({
        sql: "select id, rating, rd, last_played_at, games_played from students where id in (?, ?)",
        args: [g.white_id, g.black_id],
      })
    ).rows as unknown as Jogador[];
    const white = alunos.find((a) => a.id === g.white_id)!;
    const black = alunos.find((a) => a.id === g.black_id)!;

    const r = calcularPartida({ ...white }, { ...black }, g.white_score as Result, playedAt);
    await tx.batch([
      gravarAluno(r.white),
      gravarAluno(r.black),
      {
        sql: `update games set status = 'confirmada', confirmed_by = :confirmed_by, played_at = :played_at, ${SET_AUDITORIA} where id = :id`,
        args: { id: gameId, confirmed_by: confirmedBy, played_at: playedAt.toISOString(), ...r.colunas },
      },
    ]);
    return r;
  });
}

export async function recusarPartida(gameId: string) {
  await rodar("update games set status = 'recusada' where id = ? and status = 'pendente'", [gameId]);
}

/** Anula uma partida confirmada e refaz o rating da turma inteira a partir do histórico. */
export async function anularPartida(gameId: string) {
  await transacao(async (tx) => {
    const ler = async (sql: string, args: string[]) => (await tx.execute({ sql, args })).rows.map((l) => ({ ...l }));
    const [alvo] = (await ler("select class_id, status from games where id = ?", [gameId])) as unknown as Pick<Jogo, "class_id" | "status">[];
    if (alvo?.status !== "confirmada") throw new ErroPartida("resolvida");

    const alunos = await ler("select id, initial_level from students where class_id = ?", [alvo.class_id]);
    const restantes = await ler(
      "select id, white_id, black_id, white_score, played_at from games where class_id = ? and status = 'confirmada' and id <> ?",
      [alvo.class_id, gameId],
    );
    const r = replay(alunos as unknown as { id: string; initial_level: Nivel }[], restantes as unknown as PartidaReplay[]);

    await tx.batch([
      { sql: "update games set status = 'anulada' where id = ?", args: [gameId] },
      ...r.alunos.map(gravarAluno),
      ...r.partidas.map((p) => ({ sql: `update games set ${SET_AUDITORIA} where id = :id`, args: p })),
    ]);
  });
}
