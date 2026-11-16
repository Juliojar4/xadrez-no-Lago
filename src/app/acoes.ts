"use server";

import { randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEFAULT_CONFIG, type Result } from "@/lib/glicko";
import {
  NIVEIS,
  destinoSeguro,
  ehAvatar,
  ehNivel,
  ehResultado,
  type CodigoMensagem,
} from "@/lib/dominio";
import { ErroPartida, anularPartida, aplicarPartida, criarPartida, recusarPartida } from "@/lib/partidas";
import { alunoPorId, turmaUnica } from "@/lib/consultas";
import { ehDuplicado, rodar, transacao, um } from "@/lib/db";
import { conferirSegredo, gravarSegredo, novoPin } from "@/lib/pin";
import { abrirSessao, exigirAluno, exigirProfessor, fecharSessao, getViewer } from "@/lib/sessao";
import type { Jogo } from "@/lib/tipos";

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  `${caminho}?${r.erro ? `erro=${r.erro}` : `ok=${r.ok}`}`;

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I para não confundir
const novoCodigo = () => Array.from({ length: 6 }, () => LETRAS[randomInt(LETRAS.length)]).join("");

// ───────────────────────── Entrar / sair ─────────────────────────

export async function entrarAluno(fd: FormData) {
  const codigo = texto(fd, "codigo").toUpperCase();
  const alunoId = texto(fd, "aluno");
  const pin = texto(fd, "pin");
  const next = destinoSeguro(texto(fd, "next"));
  const volta = (erro: CodigoMensagem): never =>
    redirect(
      `/entrar?codigo=${encodeURIComponent(codigo)}&aluno=${encodeURIComponent(alunoId)}&next=${encodeURIComponent(next)}&erro=${erro}`,
    );
  if (!UUID.test(alunoId) || !/^\d{4}$/.test(pin)) volta("pin");

  const aluno = await um(
    "select s.id from students s join classes c on c.id = s.class_id where s.id = ? and s.active = 1 and c.join_code = ?",
    [alunoId, codigo],
  );
  if (!aluno) volta("pin");

  const r = await conferirSegredo(alunoId, pin);
  if (r !== "ok") volta(r === "bloqueado" ? "bloqueado" : "pin");
  await abrirSessao(alunoId);
  redirect(next);
}

export async function entrarProfessor(fd: FormData) {
  const prof = await um<{ id: string }>("select id from teachers");
  const r = prof ? await conferirSegredo(prof.id, texto(fd, "senha")) : "errado";
  if (r !== "ok") redirect(`/professor/entrar?erro=${r === "bloqueado" ? "bloqueado" : "login"}`);
  await abrirSessao(prof!.id);
  redirect("/professor");
}

/**
 * Primeiro acesso: cria o professor (só a senha) e a turma única do site.
 * Só funciona enquanto não existe professor; depois disso, a tela nem aparece.
 */
export async function criarSenhaProfessor(fd: FormData) {
  const senha = texto(fd, "senha");
  if (senha.length < 8 || senha !== texto(fd, "confirmar")) redirect("/professor/entrar?erro=senha");

  // A transação serializa dois pedidos simultâneos: o segundo já encontra o professor.
  const id = await transacao(async (tx) => {
    if ((await tx.execute("select 1 from teachers")).rows.length) return null;
    const novo = randomUUID();
    await tx.execute({ sql: "insert into teachers (id, name) values (?, 'Professor')", args: [novo] });
    await tx.execute({
      sql: "insert into classes (id, teacher_id, name, join_code) values (?, ?, 'Turma', ?)",
      args: [randomUUID(), novo, novoCodigo()],
    });
    await gravarSegredo(novo, senha, tx);
    return novo;
  });
  if (!id) redirect("/professor/entrar");
  await abrirSessao(id);
  redirect("/professor");
}

export async function sair() {
  await fecharSessao();
  atualizar();
  redirect("/");
}

// ───────────────────────── Professor: alunos ─────────────────────────

async function turmaDoProfessor() {
  await exigirProfessor();
  return turmaUnica();
}
async function alunoDoProfessor(alunoId: string) {
  await exigirProfessor();
  return UUID.test(alunoId) ? alunoPorId(alunoId) : undefined;
}

export type EstadoPin = { erro?: string; pin?: string; apelido?: string };

export async function criarAluno(_: EstadoPin, fd: FormData): Promise<EstadoPin> {
  const turma = await turmaDoProfessor();
  const apelido = texto(fd, "apelido");
  const nivel = texto(fd, "nivel");
  const avatar = texto(fd, "avatar");
  if (!turma || apelido.length < 2 || apelido.length > 20 || !ehNivel(nivel) || !ehAvatar(avatar))
    return { erro: "Preencha o apelido (2 a 20 letras), o nível e o avatar." };

  const id = randomUUID();
  const pin = novoPin();
  try {
    await transacao(async (tx) => {
      await tx.execute({
        sql: "insert into students (id, class_id, nickname, avatar, initial_level, rating, rd) values (?, ?, ?, ?, ?, ?, ?)",
        args: [id, turma.id, apelido, avatar, nivel, NIVEIS[nivel].rating, DEFAULT_CONFIG.initialRd],
      });
      await gravarSegredo(id, pin, tx);
    });
  } catch (e) {
    if (ehDuplicado(e)) return { erro: "Já existe um aluno com esse apelido na turma." };
    throw e;
  }
  atualizar();
  return { pin, apelido };
}

export async function redefinirPin(_: EstadoPin, fd: FormData): Promise<EstadoPin> {
  const aluno = await alunoDoProfessor(texto(fd, "aluno"));
  if (!aluno) return { erro: "Aluno não encontrado." };
  const pin = novoPin();
  await gravarSegredo(aluno.id, pin);
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
  const turma = await turmaDoProfessor();
  if (!turma) redirect("/professor");
  const base = "/professor/partidas";
  const whiteId = texto(fd, "brancas");
  const blackId = texto(fd, "pretas");
  const score = Number(texto(fd, "resultado"));
  if (!UUID.test(whiteId) || !UUID.test(blackId) || !ehResultado(score)) redirect(`${base}?erro=dados`);

  const r = await tentar(async () => {
    const id = await criarPartida({ classId: turma.id, whiteId, blackId, whiteScore: score, reportedBy: professor.id });
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

/** Confirmar ou recusar uma partida pendente: o adversário (aluno) ou o professor da turma. */
export async function responderPartida(fd: FormData) {
  const v = await getViewer();
  const gameId = texto(fd, "partida");
  const aceita = fd.get("resposta") === "sim";
  if (!v || !UUID.test(gameId)) redirect("/");

  const g = await um<Pick<Jogo, "white_id" | "black_id" | "reported_by">>(
    "select white_id, black_id, reported_by from games where id = ?",
    [gameId],
  );
  const volta = v.tipo === "professor" ? "/professor/partidas" : "/turma";
  if (!g) redirect(`${volta}?erro=resolvida`);

  const participa = g.white_id === v.id || g.black_id === v.id;
  const fuiEuQueRegistrei = g.reported_by === v.id;
  // Aluno: só quem jogou. Quem registrou não confirma a própria partida (só pode cancelar).
  if (v.tipo === "aluno" && (!participa || (aceita && fuiEuQueRegistrei))) redirect(`${volta}?erro=resolvida`);

  const r = await tentar(async () => {
    if (aceita) await aplicarPartida(gameId, v.id);
    else await recusarPartida(gameId);
    return aceita ? "confirmada" : "recusada";
  });
  atualizar();
  redirect(comMensagem(volta, r));
}

export async function anular(fd: FormData) {
  await exigirProfessor();
  const gameId = texto(fd, "partida");
  if (!UUID.test(gameId)) redirect("/professor");
  const r = await tentar(async () => {
    await anularPartida(gameId);
    return "anulada";
  });
  atualizar();
  redirect(comMensagem("/professor/partidas", r));
}
