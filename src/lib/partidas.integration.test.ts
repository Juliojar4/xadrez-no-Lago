/**
 * Fluxo de registro de partida contra o Supabase LOCAL (pnpm db:start).
 * Sem as chaves no .env.local, o arquivo inteiro é pulado.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErroPartida, anularPartida, aplicarPartida, criarPartida, recusarPartida } from "./partidas";
import { jogadorInicial, calcularPartida } from "./rating";
import { supabaseAdmin } from "./supabase/admin";
import type { Database } from "./tipos";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const temBanco = Boolean(url?.includes("127.0.0.1") && process.env.SUPABASE_SECRET_KEY);

describe.skipIf(!temBanco)("registro de partida (integração)", () => {
  const db = supabaseAdmin();
  const criados: string[] = [];
  const sufixo = Date.now();
  let professor: string, turma: string, outraTurma: string;
  let ana: string, beto: string, intruso: string;

  async function usuario(nome: string) {
    const email = `${nome}-${sufixo}@teste.local`;
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw error;
    criados.push(data.user.id);
    return { id: data.user.id, email };
  }
  async function aluno(nome: string, classId: string, nivel: "iniciante" | "avancado") {
    const u = await usuario(nome);
    const j = jogadorInicial(u.id, nivel);
    const { error } = await db.from("students").insert({
      id: u.id, class_id: classId, nickname: nome, avatar: "peao-roxo", initial_level: nivel, rating: j.rating, rd: j.rd,
    });
    if (error) throw error;
    return u;
  }
  /** Cliente logado como o usuário (passa pelo RLS, como o navegador). */
  async function clienteDe(email: string) {
    const c = createClient<Database>(url!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await db.auth.admin.generateLink({ type: "magiclink", email });
    const { error } = await c.auth.verifyOtp({ token_hash: data.properties!.hashed_token, type: "email" });
    if (error) throw error;
    return c;
  }
  const lerAluno = async (id: string) => (await db.from("students").select("*").eq("id", id).single()).data!;
  const lerPartida = async (id: string) => (await db.from("games").select("*").eq("id", id).single()).data!;

  let emailAna: string, emailIntruso: string;

  beforeAll(async () => {
    professor = (await usuario("prof")).id;
    await db.from("teachers").insert({ id: professor, name: "Prof Teste" });
    const { data: turmas } = await db
      .from("classes")
      .insert([
        { teacher_id: professor, name: "T1", join_code: `T1${sufixo}` },
        { teacher_id: professor, name: "T2", join_code: `T2${sufixo}` },
      ])
      .select("id");
    [turma, outraTurma] = turmas!.map((t) => t.id);
    const a = await aluno("Ana", turma, "iniciante");
    [ana, emailAna] = [a.id, a.email];
    beto = (await aluno("Beto", turma, "avancado")).id;
    const i = await aluno("Intruso", outraTurma, "iniciante");
    [intruso, emailIntruso] = [i.id, i.email];
  });

  afterAll(async () => {
    await db.from("classes").delete().in("id", [turma, outraTurma]);
    for (const id of criados) await db.auth.admin.deleteUser(id);
  });

  it("partida registrada fica pendente e NÃO mexe no rating", async () => {
    const id = await criarPartida({ classId: turma, whiteId: ana, blackId: beto, whiteScore: 1, reportedBy: ana });
    expect((await lerPartida(id)).status).toBe("pendente");
    expect(await lerAluno(ana)).toMatchObject({ rating: 400, rd: 350, games_played: 0 });
    await recusarPartida(id);
    expect((await lerPartida(id)).status).toBe("recusada");
    expect(await lerAluno(ana)).toMatchObject({ rating: 400, games_played: 0 });
  });

  it("recusa jogador repetido ou de outra turma", async () => {
    const base = { classId: turma, whiteScore: 1 as const, reportedBy: professor };
    await expect(criarPartida({ ...base, whiteId: ana, blackId: ana })).rejects.toBeInstanceOf(ErroPartida);
    await expect(criarPartida({ ...base, whiteId: ana, blackId: intruso })).rejects.toBeInstanceOf(ErroPartida);
  });

  let g1: string, g2: string;

  it("confirmar aplica o Glicko nos dois alunos e grava o antes/depois", async () => {
    const t = new Date("2026-03-02T15:00:00Z");
    const esperado = calcularPartida(jogadorInicial(ana, "iniciante"), jogadorInicial(beto, "avancado"), 1, t);
    g1 = await criarPartida({ classId: turma, whiteId: ana, blackId: beto, whiteScore: 1, reportedBy: ana });
    await aplicarPartida(g1, beto, t);

    expect(await lerPartida(g1)).toMatchObject({ status: "confirmada", confirmed_by: beto, ...esperado.colunas });
    expect(await lerAluno(ana)).toMatchObject({ rating: esperado.white.rating, rd: esperado.white.rd, games_played: 1 });
    expect(await lerAluno(beto)).toMatchObject({ rating: esperado.black.rating, rd: esperado.black.rd, games_played: 1 });
    expect(esperado.white.rating).toBeGreaterThan(400);
  });

  it("não aplica a mesma partida duas vezes", async () => {
    await expect(aplicarPartida(g1, beto)).rejects.toBeInstanceOf(ErroPartida);
    expect((await lerAluno(ana)).games_played).toBe(1);
  });

  it("anular recalcula a turma como se a partida nunca tivesse existido", async () => {
    const t2 = new Date("2026-03-09T15:00:00Z");
    g2 = await criarPartida({ classId: turma, whiteId: beto, blackId: ana, whiteScore: 0.5, reportedBy: professor });
    await aplicarPartida(g2, professor, t2);
    await anularPartida(g1);

    const esperado = calcularPartida(jogadorInicial(beto, "avancado"), jogadorInicial(ana, "iniciante"), 0.5, t2);
    expect((await lerPartida(g1)).status).toBe("anulada");
    expect(await lerPartida(g2)).toMatchObject(esperado.colunas);
    expect(await lerAluno(beto)).toMatchObject({ rating: esperado.white.rating, rd: esperado.white.rd, games_played: 1 });
    expect(await lerAluno(ana)).toMatchObject({ rating: esperado.black.rating, rd: esperado.black.rd, games_played: 1 });
    await expect(anularPartida(g1)).rejects.toBeInstanceOf(ErroPartida);
  });

  it("RLS: aluno vê a própria turma, não vê outra, e não escreve nada", async () => {
    const comoAna = await clienteDe(emailAna);
    const comoIntruso = await clienteDe(emailIntruso);

    expect((await comoAna.from("students").select("id")).data?.map((s) => s.id).sort()).toEqual([ana, beto].sort());
    expect((await comoAna.from("games").select("id").eq("class_id", turma)).data?.length).toBeGreaterThan(0);
    expect((await comoIntruso.from("students").select("id")).data?.map((s) => s.id)).toEqual([intruso]);
    expect((await comoIntruso.from("games").select("id").eq("class_id", turma)).data).toEqual([]);

    // PIN: ninguém lê pelo cliente. Rating: ninguém escreve pelo cliente.
    expect((await comoAna.from("student_secrets").select("*")).data ?? []).toEqual([]);
    await comoAna.from("students").update({ rating: 3000 }).eq("id", ana);
    expect((await lerAluno(ana)).rating).toBeLessThan(3000);
    expect((await comoAna.rpc("apply_game_result", { p: {} })).error).not.toBeNull();
    expect((await comoAna.rpc("claim_pin_attempt", { p_student: beto })).error).not.toBeNull();
  });
});
