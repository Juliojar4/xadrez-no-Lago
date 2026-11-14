import "server-only";
import type { Result } from "./glicko";
import { calcularPartida, replay, type PartidaReplay } from "./rating";
import { supabaseAdmin } from "./supabase/admin";
import type { CodigoMensagem, Nivel } from "./dominio";

/** Erro esperado; o código vira uma mensagem amigável em MENSAGENS (dominio.ts). */
export class ErroPartida extends Error {
  constructor(public codigo: CodigoMensagem) {
    super(codigo);
  }
}

const CONFLITO = "40001";
const TENTATIVAS = 3;

/** Cria a partida como pendente. O rating só muda em `aplicarPartida`. */
export async function criarPartida(p: {
  classId: string;
  whiteId: string;
  blackId: string;
  whiteScore: Result;
  reportedBy: string;
}): Promise<string> {
  if (p.whiteId === p.blackId) throw new ErroPartida("iguais");
  const db = supabaseAdmin();
  const { data: alunos } = await db
    .from("students")
    .select("id")
    .eq("class_id", p.classId)
    .eq("active", true)
    .in("id", [p.whiteId, p.blackId]);
  if (alunos?.length !== 2) throw new ErroPartida("turma");

  const { data, error } = await db
    .from("games")
    .insert({
      class_id: p.classId,
      white_id: p.whiteId,
      black_id: p.blackId,
      white_score: p.whiteScore,
      reported_by: p.reportedBy,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Confirma uma partida pendente: calcula o Glicko e grava tudo de uma vez. */
export async function aplicarPartida(gameId: string, confirmedBy: string, playedAt = new Date()) {
  const db = supabaseAdmin();
  for (let i = 0; i < TENTATIVAS; i++) {
    const { data: g } = await db.from("games").select("*").eq("id", gameId).maybeSingle();
    if (!g || g.status !== "pendente") throw new ErroPartida("resolvida");
    const { data: alunos } = await db
      .from("students")
      .select("id, rating, rd, last_played_at, games_played")
      .in("id", [g.white_id, g.black_id]);
    const white = alunos?.find((a) => a.id === g.white_id);
    const black = alunos?.find((a) => a.id === g.black_id);
    if (!white || !black) throw new ErroPartida("turma");

    const r = calcularPartida(white, black, g.white_score as Result, playedAt);
    const { error } = await db.rpc("apply_game_result", {
      p: {
        game_id: gameId,
        confirmed_by: confirmedBy,
        played_at: playedAt.toISOString(),
        white_games_played: white.games_played,
        black_games_played: black.games_played,
        ...r.colunas,
      },
    });
    if (!error) return r;
    if (error.code !== CONFLITO) throw error; // conflito: alguém jogou no meio; lê de novo
  }
  throw new ErroPartida("ocupado");
}

export async function recusarPartida(gameId: string) {
  const { error } = await supabaseAdmin()
    .from("games")
    .update({ status: "recusada" })
    .eq("id", gameId)
    .eq("status", "pendente");
  if (error) throw error;
}

/** Anula uma partida confirmada e refaz o rating da turma inteira a partir do histórico. */
export async function anularPartida(gameId: string) {
  const db = supabaseAdmin();
  for (let i = 0; i < TENTATIVAS; i++) {
    const { data: alvo } = await db.from("games").select("class_id, status").eq("id", gameId).maybeSingle();
    if (alvo?.status !== "confirmada") throw new ErroPartida("resolvida");

    const [{ data: alunos }, { data: partidas }] = await Promise.all([
      db.from("students").select("id, initial_level").eq("class_id", alvo.class_id),
      db
        .from("games")
        .select("id, white_id, black_id, white_score, played_at")
        .eq("class_id", alvo.class_id)
        .eq("status", "confirmada"),
    ]);
    if (!alunos || !partidas) throw new Error("falha ao ler a turma");

    const r = replay(
      alunos as { id: string; initial_level: Nivel }[],
      partidas.filter((p) => p.id !== gameId) as PartidaReplay[],
    );
    const { error } = await db.rpc("apply_recalc", {
      p_class: alvo.class_id,
      p_void: gameId,
      p_expected: partidas.length,
      p_students: r.alunos,
      p_games: r.partidas,
    });
    if (!error) return;
    if (error.code !== CONFLITO) throw error;
  }
  throw new ErroPartida("ocupado");
}
