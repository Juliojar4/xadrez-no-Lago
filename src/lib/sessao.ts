import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { rodar, um } from "./db";

export type Viewer =
  | { tipo: "professor"; id: string; nome: string }
  | { tipo: "aluno"; id: string; classId: string; apelido: string; avatar: string };

const COOKIE = "sessao";
const DURACAO_S = 30 * 86_400;
// No banco fica só o hash: quem ler o banco não consegue se passar por ninguém.
const hashDe = (token: string) => createHash("sha256").update(token).digest("hex");

/** Abre a sessão de quem acabou de acertar o PIN/senha. Só em Server Action. */
export async function abrirSessao(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const agora = Date.now();
  await rodar("delete from sessions where expires_at < ?", [new Date(agora).toISOString()]);
  await rodar("insert into sessions (token_hash, user_id, expires_at) values (?, ?, ?)", [
    hashDe(token),
    userId,
    new Date(agora + DURACAO_S * 1000).toISOString(),
  ]);
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
  if (token) await rodar("delete from sessions where token_hash = ?", [hashDe(token)]);
  jar.delete(COOKIE);
}

/** Quem está navegando. O papel vem das TABELAS, a cada pedido (aluno desativado sai na hora). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  // Tudo depois daqui depende da hora (sessão, RD do Glicko): só renderiza no pedido.
  await connection();
  // Uma ida só ao banco: a sessão e, junto, o professor ou o aluno dono dela.
  const l = await um<{
    id: string;
    nome: string | null;
    class_id: string | null;
    nickname: string;
    avatar: string;
  }>(
    `select s.user_id id, t.name nome, a.class_id, a.nickname, a.avatar
     from sessions s
     left join teachers t on t.id = s.user_id
     left join students a on a.id = s.user_id and a.active = 1
     where s.token_hash = ? and s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    [hashDe(token)],
  );
  if (l?.nome != null) return { tipo: "professor", id: l.id, nome: l.nome };
  if (l?.class_id) return { tipo: "aluno", id: l.id, classId: l.class_id, apelido: l.nickname, avatar: l.avatar };
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
