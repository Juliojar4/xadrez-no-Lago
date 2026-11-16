/**
 * Fluxo de registro de partida contra um arquivo SQLite temporário (TURSO_DATABASE_URL no vitest.config).
 */
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { rodar, transacao, um } from "./db";
import { ErroPartida, anularPartida, aplicarPartida, criarPartida, recusarPartida } from "./partidas";
import { conferirSegredo, entrarComPin, gravarPin, gravarSegredo } from "./pin";
import { jogadorInicial, calcularPartida } from "./rating";
import type { Aluno, Jogo } from "./tipos";

describe("registro de partida (integração)", () => {
  const professor = randomUUID();
  const turma = randomUUID();
  let ana: string, beto: string, desativado: string;

  async function aluno(apelido: string, nivel: "iniciante" | "avancado", active = 1) {
    const id = randomUUID();
    const j = jogadorInicial(id, nivel);
    await rodar(
      "insert into students (id, class_id, nickname, avatar, initial_level, rating, rd, active) values (?, ?, ?, 'peao-roxo', ?, ?, ?, ?)",
      [id, turma, apelido, nivel, j.rating, j.rd, active],
    );
    return id;
  }
  const lerAluno = async (id: string) => (await um<Aluno>("select * from students where id = ?", [id]))!;
  const lerPartida = async (id: string) => (await um<Jogo>("select * from games where id = ?", [id]))!;

  beforeAll(async () => {
    await rodar("insert into cities (id, name) values (?, 'Cidade')", [professor]);
    await rodar("insert into classes (id, city_id, name) values (?, ?, 'Local')", [turma, professor]);
    ana = await aluno("Ana", "iniciante");
    beto = await aluno("Beto", "avancado");
    desativado = await aluno("Fora", "iniciante", 0);
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

  it("o banco não aceita cidade, local ou apelido repetidos", async () => {
    await expect(rodar("insert into cities (id, name) values ('outra', 'CIDADE')")).rejects.toThrow(/UNIQUE/);
    await expect(rodar("insert into classes (id, city_id, name) values ('outro', ?, 'LOCAL')", [professor])).rejects.toThrow(/UNIQUE/);
    await expect(aluno("ANA", "iniciante")).rejects.toThrow(/UNIQUE/);
  });

  const t = new Date("2026-03-02T15:00:00Z");
  const depois = new Date(t.getTime() + 16 * 60_000);

  it("senha: 5 erros seguidos bloqueiam por 15 minutos, mesmo com a senha certa", async () => {
    await gravarSegredo(professor, "segredo-certo");
    expect(await conferirSegredo(professor, "segredo-certo", t)).toBe("ok");
    for (let i = 0; i < 5; i++) expect(await conferirSegredo(professor, "errada", t)).toBe("errado");
    expect(await conferirSegredo(professor, "segredo-certo", t)).toBe("bloqueado");
    expect(await conferirSegredo(professor, "segredo-certo", depois)).toBe("ok");
    expect(await conferirSegredo("ninguem", "segredo-certo", t)).toBe("errado");
  });

  it("PIN: acha o aluno só pelo PIN dentro do local, sem repetir PIN", async () => {
    const outroLocal = "11111111-1111-4111-8111-111111111111";
    await rodar("insert into classes (id, city_id, name) values (?, ?, 'Outro')", [outroLocal, professor]);
    await transacao(async (tx) => {
      await gravarPin(tx, ana, turma, "1234");
      await gravarPin(tx, desativado, turma, "5678");
      // PIN já usado no local: o pedido explícito falha, o sorteio escolhe outro
      await expect(gravarPin(tx, beto, turma, "1234")).rejects.toThrow();
      expect(await gravarPin(tx, beto, turma)).not.toBe("1234");
    });
    expect(await entrarComPin(turma, "1234", "ip1", t)).toEqual({ id: ana });
    expect(await entrarComPin(turma, "0000", "ip1", t)).toBe("errado");
    expect(await entrarComPin(turma, "5678", "ip1", t)).toBe("errado"); // aluno desativado
    expect(await entrarComPin(outroLocal, "1234", "ip1", t)).toBe("errado"); // PIN de outro local
  });

  it("PIN: 10 erros seguidos do mesmo IP bloqueiam só aquele IP", async () => {
    for (let i = 0; i < 10; i++) expect(await entrarComPin(turma, "0000", "ip2", t)).toBe("errado");
    expect(await entrarComPin(turma, "1234", "ip2", t)).toBe("bloqueado");
    expect(await entrarComPin(turma, "1234", "ip3", t)).toEqual({ id: ana });
    expect(await entrarComPin(turma, "1234", "ip2", depois)).toEqual({ id: ana });
  });
});
