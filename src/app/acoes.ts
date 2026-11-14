"use server";

import { randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEFAULT_CONFIG, type Result } from "@/lib/glicko";
import {
  DOMINIO_INTERNO,
  EMAIL_PROFESSOR,
  NIVEIS,
  destinoSeguro,
  ehAvatar,
  ehNivel,
  ehResultado,
  type CodigoMensagem,
} from "@/lib/dominio";
import { ErroPartida, anularPartida, aplicarPartida, criarPartida, recusarPartida } from "@/lib/partidas";
import { conferePin, hashPin, novoPin } from "@/lib/pin";
import { exigirAluno, exigirProfessor, getViewer } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

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

  const db = supabaseAdmin();
  const { data: aluno } = await db
    .from("students")
    .select("id, classes!inner(join_code)")
    .eq("id", alunoId)
    .eq("active", true)
    .eq("classes.join_code", codigo)
    .maybeSingle();
  if (!aluno) volta("pin");

  // conta a tentativa antes de conferir; sem hash = bloqueado
  const { data: hash } = await db.rpc("claim_pin_attempt", { p_student: alunoId });
  if (!hash) volta("bloqueado");
  if (!conferePin(pin, hash as string)) volta("pin");
  await db.from("student_secrets").update({ failed_attempts: 0, locked_until: null }).eq("student_id", alunoId);

  // PIN certo: o servidor gera um token de uso único e abre a sessão do aluno.
  const { data: u } = await db.auth.admin.getUserById(alunoId);
  const { data: link, error } = await db.auth.admin.generateLink({ type: "magiclink", email: u.user!.email! });
  if (error) throw error;
  const supabase = await supabaseServer();
  const { error: erroSessao } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });
  if (erroSessao) throw erroSessao;
  redirect(next);
}

export async function entrarProfessor(fd: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: EMAIL_PROFESSOR, password: texto(fd, "senha") });
  redirect(error ? "/professor/entrar?erro=login" : "/professor");
}

/**
 * Primeiro acesso: cria o professor (só a senha) e a turma única do site.
 * Só funciona enquanto não existe professor; depois disso, a tela nem aparece.
 */
export async function criarSenhaProfessor(fd: FormData) {
  const senha = texto(fd, "senha");
  if (senha.length < 8 || senha !== texto(fd, "confirmar")) redirect("/professor/entrar?erro=senha");

  const db = supabaseAdmin();
  const { count } = await db.from("teachers").select("id", { count: "exact", head: true });
  if (count) redirect("/professor/entrar");
  // Se dois pedidos chegarem juntos, o e-mail fixo e os índices únicos do banco barram o segundo.
  const { data, error } = await db.auth.admin.createUser({ email: EMAIL_PROFESSOR, password: senha, email_confirm: true });
  if (error) redirect("/professor/entrar");
  const id = data.user.id;
  const { error: erroProf } = await db.from("teachers").insert({ id, name: "Professor" });
  if (erroProf) throw erroProf;
  const { error: erroTurma } = await db.from("classes").insert({ teacher_id: id, name: "Turma", join_code: novoCodigo() });
  if (erroTurma) throw erroTurma;

  const supabase = await supabaseServer();
  await supabase.auth.signInWithPassword({ email: EMAIL_PROFESSOR, password: senha });
  redirect("/professor");
}

export async function sair() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  atualizar();
  redirect("/");
}

// ───────────────────────── Professor: alunos ─────────────────────────

/** A turma única. A leitura passa pelo RLS: só o professor dono recebe a linha. */
async function turmaDoProfessor() {
  await exigirProfessor();
  const supabase = await supabaseServer();
  const { data } = await supabase.from("classes").select("id").maybeSingle();
  return data;
}
async function alunoDoProfessor(alunoId: string) {
  await exigirProfessor();
  if (!UUID.test(alunoId)) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("students").select("id, class_id, nickname").eq("id", alunoId).maybeSingle();
  return data;
}

export type EstadoPin = { erro?: string; pin?: string; apelido?: string };

export async function criarAluno(_: EstadoPin, fd: FormData): Promise<EstadoPin> {
  const turma = await turmaDoProfessor();
  const apelido = texto(fd, "apelido");
  const nivel = texto(fd, "nivel");
  const avatar = texto(fd, "avatar");
  if (!turma || apelido.length < 2 || apelido.length > 20 || !ehNivel(nivel) || !ehAvatar(avatar))
    return { erro: "Preencha o apelido (2 a 20 letras), o nível e o avatar." };

  const db = supabaseAdmin();
  const { data: novo, error } = await db.auth.admin.createUser({
    email: `${randomUUID()}@${DOMINIO_INTERNO}`,
    email_confirm: true,
  });
  if (error) throw error;
  const id = novo.user.id;

  const { error: erroAluno } = await db.from("students").insert({
    id,
    class_id: turma.id,
    nickname: apelido,
    avatar,
    initial_level: nivel,
    rating: NIVEIS[nivel].rating,
    rd: DEFAULT_CONFIG.initialRd,
  });
  if (erroAluno) {
    await db.auth.admin.deleteUser(id);
    if (erroAluno.code === "23505") return { erro: "Já existe um aluno com esse apelido na turma." };
    throw erroAluno;
  }
  const pin = novoPin();
  const { error: erroPin } = await db.from("student_secrets").insert({ student_id: id, pin_hash: hashPin(pin) });
  if (erroPin) throw erroPin;
  atualizar();
  return { pin, apelido };
}

export async function redefinirPin(_: EstadoPin, fd: FormData): Promise<EstadoPin> {
  const aluno = await alunoDoProfessor(texto(fd, "aluno"));
  if (!aluno) return { erro: "Aluno não encontrado." };
  const pin = novoPin();
  const { error } = await supabaseAdmin()
    .from("student_secrets")
    .upsert({ student_id: aluno.id, pin_hash: hashPin(pin), failed_attempts: 0, locked_until: null });
  if (error) throw error;
  return { pin, apelido: aluno.nickname };
}

export async function alternarAtivo(fd: FormData) {
  const aluno = await alunoDoProfessor(texto(fd, "aluno"));
  if (aluno) {
    await supabaseAdmin().from("students").update({ active: fd.get("ativo") === "sim" }).eq("id", aluno.id);
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

  // Leitura com RLS: só volta se a partida é da turma de quem pede.
  const supabase = await supabaseServer();
  const { data: g } = await supabase
    .from("games")
    .select("class_id, white_id, black_id, reported_by")
    .eq("id", gameId)
    .maybeSingle();
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
  const supabase = await supabaseServer();
  const { data: g } = await supabase.from("games").select("id").eq("id", gameId).maybeSingle();
  if (!g) redirect("/professor");
  const r = await tentar(async () => {
    await anularPartida(gameId);
    return "anulada";
  });
  atualizar();
  redirect(comMensagem("/professor/partidas", r));
}
