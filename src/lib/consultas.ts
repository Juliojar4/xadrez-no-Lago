import "server-only";
import { supabaseServer } from "./supabase/server";

const COLUNAS_ALUNO = "id, nickname, avatar, rating, rd, last_played_at, games_played" as const;

/** Alunos ativos de uma turma (o RLS decide se quem pede pode ver). */
export async function alunosDaTurma(classId: string) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("students")
    .select(COLUNAS_ALUNO)
    .eq("class_id", classId)
    .eq("active", true)
    .order("nickname");
  if (error) throw error;
  return data;
}

const COLUNAS_PARTIDA =
  "*, white:students!games_white_id_fkey(nickname, avatar), black:students!games_black_id_fkey(nickname, avatar)" as const;

export async function partidas(filtro: { classId?: string; alunoId?: string; status: "pendente" | "confirmada"; limite?: number }) {
  const supabase = await supabaseServer();
  let q = supabase.from("games").select(COLUNAS_PARTIDA).eq("status", filtro.status);
  if (filtro.classId) q = q.eq("class_id", filtro.classId);
  if (filtro.alunoId) q = q.or(`white_id.eq.${filtro.alunoId},black_id.eq.${filtro.alunoId}`);
  const { data, error } = await q
    .order(filtro.status === "confirmada" ? "played_at" : "created_at", { ascending: false })
    .limit(filtro.limite ?? 500);
  if (error) throw error;
  return data;
}
export type Partida = Awaited<ReturnType<typeof partidas>>[number];

const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
export const dataCurta = (iso: string | null) => (iso ? dia.format(new Date(iso)) : "");
