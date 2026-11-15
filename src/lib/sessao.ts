import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

export type Viewer =
  | { tipo: "professor"; id: string; nome: string }
  | { tipo: "aluno"; id: string; classId: string; apelido: string; avatar: string };

const COOKIE = "sessao";
const DURACAO_S = 30 * 86_400;
// No banco fica só o hash: quem ler o arquivo não consegue se passar por ninguém.
const hashDe = (token: string) => createHash("sha256").update(token).digest("hex");

/** Abre a sessão de quem acabou de acertar o PIN/senha. Só em Server Action. */
export async function abrirSessao(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const agora = Date.now();
  db.prepare("delete from sessions where expires_at < ?").run(new Date(agora).toISOString());
  db.prepare("insert into sessions (token_hash, user_id, expires_at) values (?, ?, ?)").run(
    hashDe(token),
    userId,
    new Date(agora + DURACAO_S * 1000).toISOString(),
  );
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_S,
  });
}

export async function fecharSessao() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.prepare("delete from sessions where token_hash = ?").run(hashDe(token));
  jar.delete(COOKIE);
}

/** Quem está navegando. O papel vem das TABELAS, a cada pedido (aluno desativado sai na hora). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const sessao = db
    .prepare("select user_id from sessions where token_hash = ? and expires_at > ?")
    .get(hashDe(token), new Date().toISOString());
  if (!sessao) return null;
  const id = sessao.user_id as string;

  const prof = db.prepare("select name from teachers where id = ?").get(id);
  if (prof) return { tipo: "professor", id, nome: prof.name as string };
  const aluno = db.prepare("select class_id, nickname, avatar from students where id = ? and active = 1").get(id);
  if (aluno)
    return {
      tipo: "aluno",
      id,
      classId: aluno.class_id as string,
      apelido: aluno.nickname as string,
      avatar: aluno.avatar as string,
    };
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

export const inicioDe = (v: Viewer) => (v.tipo === "professor" ? "/professor" : "/turma");
