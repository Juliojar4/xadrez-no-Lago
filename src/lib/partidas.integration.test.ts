/**
 * Fluxo de registro de partida contra um SQLite em memória (DATABASE_PATH no vitest.config).
 */
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { ErroPartida, anularPartida, aplicarPartida, criarPartida, recusarPartida } from "./partidas";
import { conferirSegredo, gravarSegredo } from "./pin";
import { jogadorInicial, calcularPartida } from "./rating";
import type { Aluno, Jogo } from "./tipos";

describe("registro de partida (integração)", () => {
  const professor = randomUUID();
  const turma = randomUUID();
  let ana: string, beto: string, desativado: string;

  function aluno(apelido: string, nivel: "iniciante" | "avancado", active = 1) {
    const id = randomUUID();
    const j = jogadorInicial(id, nivel);
    db.prepare(
      "insert into students (id, class_id, nickname, avatar, initial_level, rating, rd, active) values (?, ?, ?, 'peao-roxo', ?, ?, ?, ?)",
    ).run(id, turma, apelido, nivel, j.rating, j.rd, active);
    return id;
  }
  const lerAluno = async (id: string) => db.prepare("select * from students where id = ?").get(id) as Aluno;
  const lerPartida = async (id: string) => db.prepare("select * from games where id = ?").get(id) as Jogo;

  beforeAll(() => {
    db.prepare("insert into teachers (id, name) values (?, 'Professor')").run(professor);
    db.prepare("insert into classes (id, teacher_id, name, join_code) values (?, ?, 'Turma', 'TESTE')").run(turma, professor);
    ana = aluno("Ana", "iniciante");
    beto = aluno("Beto", "avancado");
    desativado = aluno("Fora", "iniciante", 0);
  });

  it("partida registrada fica pendente e NÃO mexe no rating", async () => {
    const id = await criarPartida({ classId: turma, whiteId: ana, blackId: beto, whiteScore: 1, reportedBy: ana });
    expect((await lerPartida(id)).status).toBe("pendente");
    expect(await lerAluno(ana)).toMatchObject({ rating: 400, rd: 350, games_played: 0 });
    await recusarPartida(id);
    expect((await lerPartida(id)).status).toBe("recusada");
    expect(await lerAluno(ana)).toMatchObject({ rating: 400, games_played: 0 });
  });

  it("recusa jogador repetido, desativado ou que não é aluno", async () => {
    const base = { classId: turma, whiteScore: 1 as const, reportedBy: professor };
    await expect(criarPartida({ ...base, whiteId: ana, blackId: ana })).rejects.toBeInstanceOf(ErroPartida);
    await expect(criarPartida({ ...base, whiteId: ana, blackId: desativado })).rejects.toBeInstanceOf(ErroPartida);
    await expect(criarPartida({ ...base, whiteId: ana, blackId: professor })).rejects.toBeInstanceOf(ErroPartida);
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

  it("o banco só aceita um professor, uma turma e apelidos diferentes", () => {
    expect(() => db.prepare("insert into teachers (id, name) values ('outro', 'Outro')").run()).toThrow(/UNIQUE/);
    expect(() => aluno("ANA", "iniciante")).toThrow(/UNIQUE/);
  });

  it("PIN: 5 erros seguidos bloqueiam por 15 minutos, mesmo com o PIN certo", () => {
    gravarSegredo(ana, "1234");
    const t = new Date("2026-03-02T15:00:00Z");
    expect(conferirSegredo(ana, "1234", t)).toBe("ok");
    for (let i = 0; i < 5; i++) expect(conferirSegredo(ana, "0000", t)).toBe("errado");
    expect(conferirSegredo(ana, "1234", t)).toBe("bloqueado");
    expect(conferirSegredo(ana, "1234", new Date(t.getTime() + 16 * 60_000))).toBe("ok");
    expect(conferirSegredo("ninguem", "1234", t)).toBe("bloqueado");
  });
});
