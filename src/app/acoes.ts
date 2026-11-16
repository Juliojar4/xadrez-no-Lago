"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_CONFIG, type Result } from "@/lib/glicko";
import { NIVEIS, PIN_DIGITOS, destinoSeguro, ehAvatar, ehNivel, ehResultado, type CodigoMensagem } from "@/lib/dominio";
import { ErroPartida, anularPartida, aplicarPartida, criarPartida, recusarPartida } from "@/lib/partidas";
import { alunoDaCidade, partidaDaCidade } from "@/lib/consultas";
import { ehDuplicado, rodar, transacao, um } from "@/lib/db";
import { conferirSegredo, entrarComPin, gravarPin, gravarSegredo } from "@/lib/pin";
import { abrirSessao, exigirAdmin, exigirAluno, exigirProfessor, fecharSessao, getViewer } from "@/lib/sessao";
import type { Jogo } from "@/lib/tipos";

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIN = new RegExp(`^\\d{${PIN_DIGITOS}}$`);
const nomeValido = (n: string) => n.length >= 2 && n.length <= 60;

const atualizar = () => revalidatePath("/", "layout");

/** Roda o fluxo de partida e devolve o código da mensagem (erro esperado ou sucesso). */
async function tentar(fn: () => Promise<CodigoMensagem>): Promise<{ ok?: CodigoMensagem; erro?: CodigoMensagem }> {
  try {
    return { ok: await fn() };
  } catch (e) {
    if (e instanceof ErroPartida) return { erro: e.codigo };
    throw e;
  }
}
const comMensagem = (caminho: string, r: { ok?: string; erro?: string }) =>
  `${caminho}${caminho.includes("?") ? "&" : "?"}${r.erro ? `erro=${r.erro}` : `ok=${r.ok}`}`;

// ───────────────────────── Entrar / sair ─────────────────────────

/** O aluno escolheu a cidade e o local; aqui chega só o PIN. */
export async function entrarAluno(fd: FormData) {
  const cidade = texto(fd, "cidade");
  const local = texto(fd, "local");
  const pin = texto(fd, "pin");
  const next = destinoSeguro(texto(fd, "next"));
  const volta = (erro: CodigoMensagem): never =>
    redirect(
      `/entrar?cidade=${encodeURIComponent(cidade)}&local=${encodeURIComponent(local)}&next=${encodeURIComponent(next)}&erro=${erro}`,
    );
  if (!UUID.test(local) || !PIN.test(pin)) volta("pin");

  // Na Vercel o x-forwarded-for é preenchido pela plataforma (o primeiro é o visitante).
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const r = await entrarComPin(local, pin, ip);
  if (typeof r === "string") return volta(r === "bloqueado" ? "bloqueado" : "pin");
  await abrirSessao(r.id);
  redirect(next);
}

export async function entrarProfessor(fd: FormData) {
  const cidade = texto(fd, "cidade");
  const volta = (erro: CodigoMensagem): never => redirect(`/professor/entrar?cidade=${encodeURIComponent(cidade)}&erro=${erro}`);
  if (!UUID.test(cidade) || !(await um("select 1 from cities where id = ?", [cidade]))) volta("login");
  const r = await conferirSegredo(cidade, texto(fd, "senha"));
  if (r !== "ok") volta(r === "bloqueado" ? "bloqueado" : "login");
  await abrirSessao(cidade);
  redirect("/professor");
}

export async function entrarAdmin(fd: FormData) {
  const r = await conferirSegredo("admin", texto(fd, "senha"));
  if (r !== "ok") redirect(`/admin/entrar?erro=${r === "bloqueado" ? "bloqueado" : "login"}`);
  await abrirSessao("admin");
  redirect("/admin");
}

/**
 * Primeiro acesso: cria a senha do administrador.
 * Só funciona enquanto ela não existe; depois disso, a tela nem aparece.
 */
export async function criarSenhaAdmin(fd: FormData) {
  const senha = texto(fd, "senha");
  if (senha.length < 8 || senha !== texto(fd, "confirmar")) redirect("/admin/entrar?erro=senha");

  // A transação serializa dois pedidos simultâneos: o segundo já encontra a senha criada.
  const criou = await transacao(async (tx) => {
    if ((await tx.execute("select 1 from secrets where user_id = 'admin'")).rows.length) return false;
    await gravarSegredo("admin", senha, tx);
    return true;
  });
  if (!criou) redirect("/admin/entrar");
  await abrirSessao("admin");
  redirect("/admin");
}

export async function sair() {
  await fecharSessao();
  atualizar();
  redirect("/");
}

// ───────────────────────── Administrador: cidades ─────────────────────────

/** Cria a cidade e a senha do professor dela. */
export async function criarCidade(fd: FormData) {
  await exigirAdmin();
  const nome = texto(fd, "nome");
  const senha = texto(fd, "senha");
  if (!nomeValido(nome)) redirect("/admin?erro=nome");
  if (senha.length < 8) redirect("/admin?erro=senha");
  try {
    await transacao(async (tx) => {
      const id = randomUUID();
      await tx.execute({ sql: "insert into cities (id, name) values (?, ?)", args: [id, nome] });
      await gravarSegredo(id, senha, tx);
    });
  } catch (e) {
    if (ehDuplicado(e)) redirect("/admin?erro=nome");
    throw e;
  }
  atualizar();
  redirect("/admin?ok=criado");
}

export async function trocarSenhaCidade(fd: FormData) {
  await exigirAdmin();
  const cidade = texto(fd, "cidade");
  const senha = texto(fd, "senha");
  if (senha.length < 8) redirect("/admin?erro=senha");
  if (!UUID.test(cidade) || !(await um("select 1 from cities where id = ?", [cidade]))) redirect("/admin");
  await gravarSegredo(cidade, senha);
  // quem estava logado com a senha antiga sai
  await rodar("delete from sessions where user_id = ?", [cidade]);
  redirect("/admin?ok=senhaTrocada");
}

// ───────────────────────── Professor: locais e alunos ─────────────────────────

/** O local, se for da cidade do professor logado. */
async function localDoProfessor(localId: string) {
  const prof = await exigirProfessor();
  if (!UUID.test(localId)) return undefined;
  return um<{ id: string }>("select id from classes where id = ? and city_id = ?", [localId, prof.id]);
}
async function alunoDoProfessor(alunoId: string) {
  const prof = await exigirProfessor();
  return UUID.test(alunoId) ? alunoDaCidade(alunoId, prof.id) : undefined;
}

export async function criarLocal(fd: FormData) {
  const prof = await exigirProfessor();
  const nome = texto(fd, "nome");
  if (!nomeValido(nome)) redirect("/professor?erro=nome");
  const id = randomUUID();
  try {
    await rodar("insert into classes (id, city_id, name) values (?, ?, ?)", [id, prof.id, nome]);
  } catch (e) {
    if (ehDuplicado(e)) redirect("/professor?erro=nome");
    throw e;
  }
  atualizar();
  redirect(`/professor?local=${id}&ok=criado`);
}

export type EstadoPin = { erro?: string; pin?: string; apelido?: string };

export async function criarAluno(_: EstadoPin, fd: FormData): Promise<EstadoPin> {
  const local = await localDoProfessor(texto(fd, "local"));
  const apelido = texto(fd, "apelido");
  const nivel = texto(fd, "nivel");
  const avatar = texto(fd, "avatar");
  if (!local || apelido.length < 2 || apelido.length > 20 || !ehNivel(nivel) || !ehAvatar(avatar))
    return { erro: "Preencha o apelido (2 a 20 letras), o nível e o avatar." };

  const id = randomUUID();
  try {
    const pin = await transacao(async (tx) => {
      await tx.execute({
        sql: "insert into students (id, class_id, nickname, avatar, initial_level, rating, rd) values (?, ?, ?, ?, ?, ?, ?)",
        args: [id, local.id, apelido, avatar, nivel, NIVEIS[nivel].rating, DEFAULT_CONFIG.initialRd],
      });
      return gravarPin(tx, id, local.id);
    });
    atualizar();
    return { pin, apelido };
  } catch (e) {
    if (ehDuplicado(e)) return { erro: "Já existe um aluno com esse apelido neste local." };
    throw e;
  }
}

export async function redefinirPin(_: EstadoPin, fd: FormData): Promise<EstadoPin> {
  const aluno = await alunoDoProfessor(texto(fd, "aluno"));
  if (!aluno) return { erro: "Aluno não encontrado." };
  const pin = await transacao((tx) => gravarPin(tx, aluno.id, aluno.class_id));
  return { pin, apelido: aluno.nickname };
}

export async function alternarAtivo(fd: FormData) {
  const aluno = await alunoDoProfessor(texto(fd, "aluno"));
  if (aluno) {
    await rodar("update students set active = ? where id = ?", [fd.get("ativo") === "sim" ? 1 : 0, aluno.id]);
    atualizar();
  }
}

// ───────────────────────── Partidas ─────────────────────────

export async function registrarPartidaProfessor(fd: FormData) {
  const professor = await exigirProfessor();
  const local = await localDoProfessor(texto(fd, "local"));
  if (!local) redirect("/professor");
  const base = `/professor/partidas?local=${local.id}`;
  const whiteId = texto(fd, "brancas");
  const blackId = texto(fd, "pretas");
  const score = Number(texto(fd, "resultado"));
  if (!UUID.test(whiteId) || !UUID.test(blackId) || !ehResultado(score)) redirect(`${base}&erro=dados`);

  const r = await tentar(async () => {
    const id = await criarPartida({ classId: local.id, whiteId, blackId, whiteScore: score, reportedBy: professor.id });
    await aplicarPartida(id, professor.id);
    return "registrada";
  });
  atualizar();
  redirect(comMensagem(base, r));
}

export async function registrarPartidaAluno(fd: FormData) {
  const eu = await exigirAluno("/registrar");
  const adversario = texto(fd, "adversario");
  const cor = texto(fd, "cor");
  const meuPlacar = ({ ganhei: 1, empatei: 0.5, perdi: 0 } as Record<string, Result>)[texto(fd, "resultado")];
  if (!UUID.test(adversario) || (cor !== "brancas" && cor !== "pretas") || meuPlacar === undefined)
    redirect("/registrar?erro=dados");

  const souBrancas = cor === "brancas";
  const r = await tentar(async () => {
    await criarPartida({
      classId: eu.classId,
      whiteId: souBrancas ? eu.id : adversario,
      blackId: souBrancas ? adversario : eu.id,
      whiteScore: (souBrancas ? meuPlacar : 1 - meuPlacar) as Result,
      reportedBy: eu.id,
    });
    return "enviada";
  });
  atualizar();
  redirect(r.erro ? `/registrar?erro=${r.erro}` : "/turma?ok=enviada");
}

/** Confirmar ou recusar uma partida pendente: o adversário (aluno) ou o professor da cidade. */
export async function responderPartida(fd: FormData) {
  const v = await getViewer();
  const gameId = texto(fd, "partida");
  const aceita = fd.get("resposta") === "sim";
  if (!v || v.tipo === "admin" || !UUID.test(gameId)) redirect("/");

  let g: Pick<Jogo, "class_id" | "white_id" | "black_id" | "reported_by"> | undefined;
  if (v.tipo === "professor") g = await partidaDaCidade(gameId, v.id);
  else {
    g = await um<Jogo>("select * from games where id = ?", [gameId]);
    const participa = g?.white_id === v.id || g?.black_id === v.id;
    // Aluno: só quem jogou. Quem registrou não confirma a própria partida (só pode cancelar).
    if (!participa || (aceita && g?.reported_by === v.id)) g = undefined;
  }
  const volta = v.tipo === "professor" ? `/professor/partidas${g ? `?local=${g.class_id}` : ""}` : "/turma";
  if (!g) redirect(comMensagem(volta, { erro: "resolvida" }));

  const r = await tentar(async () => {
    if (aceita) await aplicarPartida(gameId, v.id);
    else await recusarPartida(gameId);
    return aceita ? "confirmada" : "recusada";
  });
  atualizar();
  redirect(comMensagem(volta, r));
}

export async function anular(fd: FormData) {
  const prof = await exigirProfessor();
  const gameId = texto(fd, "partida");
  const g = UUID.test(gameId) ? await partidaDaCidade(gameId, prof.id) : undefined;
  if (!g) redirect("/professor");
  const r = await tentar(async () => {
    await anularPartida(gameId);
    return "anulada";
  });
  atualizar();
  redirect(comMensagem(`/professor/partidas?local=${g.class_id}`, r));
}
