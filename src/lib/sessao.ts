import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export type Viewer =
  | { tipo: "professor"; id: string; nome: string }
  | { tipo: "aluno"; id: string; classId: string; apelido: string; avatar: string }
  | { tipo: "responsavel"; id: string };

/** Quem está navegando. O papel vem das TABELAS (nunca de metadados editáveis do usuário). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims.sub;
  if (!id) return null;

  const [prof, aluno, resp] = await Promise.all([
    supabase.from("teachers").select("name").eq("id", id).maybeSingle(),
    supabase.from("students").select("class_id, nickname, avatar, active").eq("id", id).maybeSingle(),
    supabase.from("guardians").select("id").eq("id", id).maybeSingle(),
  ]);
  if (prof.data) return { tipo: "professor", id, nome: prof.data.name };
  if (aluno.data?.active)
    return { tipo: "aluno", id, classId: aluno.data.class_id, apelido: aluno.data.nickname, avatar: aluno.data.avatar };
  if (resp.data) return { tipo: "responsavel", id };
  return null;
});

export async function exigirProfessor() {
  const v = await getViewer();
  if (v?.tipo !== "professor") redirect("/professor/entrar");
  return v;
}

export async function exigirAluno(voltarPara = "/turma") {
  const v = await getViewer();
  if (v?.tipo !== "aluno") redirect(`/entrar?next=${encodeURIComponent(voltarPara)}`);
  return v;
}

export async function exigirResponsavel() {
  const v = await getViewer();
  if (v?.tipo !== "responsavel") redirect("/responsavel/entrar");
  return v;
}

export const inicioDe = (v: Viewer) =>
  v.tipo === "professor" ? "/professor" : v.tipo === "aluno" ? "/turma" : "/responsavel";
