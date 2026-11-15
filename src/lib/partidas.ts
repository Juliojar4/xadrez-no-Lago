import "server-only";
import { randomUUID } from "node:crypto";
import { db, transacao } from "./db";
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

// O SQLite é síncrono e cada fluxo abaixo roda numa transação: entre ler o rating e
// gravar o novo, ninguém mais escreve. Por isso não há mais "tentar de novo".

const gravarAluno = (j: Jogador) =>
  db
    .prepare(
      "update students set rating = :rating, rd = :rd, last_played_at = :last_played_at, games_played = :games_played where id = :id",
    )
    .run(j);

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
  const { n } = db
    .prepare("select count(*) n from students where class_id = ? and active = 1 and id in (?, ?)")
    .get(p.classId, p.whiteId, p.blackId) as { n: number };
  if (n !== 2) throw new ErroPartida("turma");

  const id = randomUUID();
  db.prepare("insert into games (id, class_id, white_id, black_id, white_score, reported_by) values (?, ?, ?, ?, ?, ?)").run(
    id,
    p.classId,
    p.whiteId,
    p.blackId,
    p.whiteScore,
    p.reportedBy,
  );
  return id;
}

/** Confirma uma partida pendente: calcula o Glicko e grava tudo de uma vez. */
export async function aplicarPartida(gameId: string, confirmedBy: string, playedAt = new Date()) {
  return transacao(() => {
    const g = db.prepare("select * from games where id = ?").get(gameId) as Jogo | undefined;
    if (g?.status !== "pendente") throw new ErroPartida("resolvida");
    const ler = db.prepare("select id, rating, rd, last_played_at, games_played from students where id = ?");
    const white = ler.get(g.white_id) as Jogador;
    const black = ler.get(g.black_id) as Jogador;

    const r = calcularPartida(white, black, g.white_score as Result, playedAt);
    gravarAluno(r.white);
    gravarAluno(r.black);
    db.prepare(
      `update games set status = 'confirmada', confirmed_by = :confirmed_by, played_at = :played_at, ${SET_AUDITORIA} where id = :id`,
    ).run({ id: gameId, confirmed_by: confirmedBy, played_at: playedAt.toISOString(), ...r.colunas });
    return r;
  });
}

export async function recusarPartida(gameId: string) {
  db.prepare("update games set status = 'recusada' where id = ? and status = 'pendente'").run(gameId);
}

/** Anula uma partida confirmada e refaz o rating da turma inteira a partir do histórico. */
export async function anularPartida(gameId: string) {
  transacao(() => {
    const alvo = db.prepare("select class_id, status from games where id = ?").get(gameId) as
      | Pick<Jogo, "class_id" | "status">
      | undefined;
    if (alvo?.status !== "confirmada") throw new ErroPartida("resolvida");
    db.prepare("update games set status = 'anulada' where id = ?").run(gameId);

    const alunos = db.prepare("select id, initial_level from students where class_id = ?").all(alvo.class_id);
    const restantes = db
      .prepare("select id, white_id, black_id, white_score, played_at from games where class_id = ? and status = 'confirmada'")
      .all(alvo.class_id);
    const r = replay(alunos as { id: string; initial_level: Nivel }[], restantes as unknown as PartidaReplay[]);

    for (const a of r.alunos) gravarAluno(a);
    const gravarPartida = db.prepare(`update games set ${SET_AUDITORIA} where id = :id`);
    for (const p of r.partidas) gravarPartida.run(p);
  });
}
