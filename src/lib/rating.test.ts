import { describe, expect, it } from "vitest";
import { recordGame } from "./glicko";
import { calcularPartida, jogadorInicial, paraPlayer, replay, type PartidaReplay } from "./rating";

const quando = (dia: number) => new Date(Date.UTC(2026, 2, dia, 15)).toISOString();

describe("calcularPartida", () => {
  it("guarda o antes e o depois dos dois jogadores, iguais ao glicko.ts", () => {
    const white = jogadorInicial("w", "iniciante");
    const black = jogadorInicial("b", "avancado");
    const t = new Date(quando(1));
    const r = calcularPartida(white, black, 1, t);
    const direto = recordGame(paraPlayer(white), paraPlayer(black), 1, t);

    expect(r.colunas).toEqual({
      white_rating_before: 400,
      white_rd_before: 350,
      white_rating_after: direto.a.rating,
      white_rd_after: direto.a.rd,
      black_rating_before: 1200,
      black_rd_before: 350,
      black_rating_after: direto.b.rating,
      black_rd_after: direto.b.rd,
    });
    expect(r.white).toMatchObject({ id: "w", rating: direto.a.rating, games_played: 1, last_played_at: t.toISOString() });
    expect([r.deltaWhite, r.deltaBlack]).toEqual([direto.deltaA, direto.deltaB]);
  });
});

describe("replay da turma", () => {
  const alunos = [
    { id: "a", initial_level: "iniciante" as const },
    { id: "b", initial_level: "intermediario" as const },
    { id: "c", initial_level: "avancado" as const },
  ];
  const partidas: PartidaReplay[] = [
    { id: "g1", white_id: "a", black_id: "b", white_score: 1, played_at: quando(1) },
    { id: "g2", white_id: "b", black_id: "c", white_score: 0.5, played_at: quando(8) },
    { id: "g3", white_id: "c", black_id: "a", white_score: 0, played_at: quando(15) },
  ];

  it("dá o mesmo resultado que aplicar partida por partida", () => {
    let a = jogadorInicial("a", "iniciante");
    let b = jogadorInicial("b", "intermediario");
    let c = jogadorInicial("c", "avancado");
    const r1 = calcularPartida(a, b, 1, new Date(quando(1)));
    [a, b] = [r1.white, r1.black];
    const r2 = calcularPartida(b, c, 0.5, new Date(quando(8)));
    [b, c] = [r2.white, r2.black];
    const r3 = calcularPartida(c, a, 0, new Date(quando(15)));
    [c, a] = [r3.white, r3.black];

    const r = replay(alunos, partidas);
    expect(r.alunos).toEqual([a, b, c]);
    expect(r.partidas).toEqual([
      { id: "g1", ...r1.colunas },
      { id: "g2", ...r2.colunas },
      { id: "g3", ...r3.colunas },
    ]);
  });

  it("não depende da ordem em que as partidas chegam do banco", () => {
    expect(replay(alunos, [...partidas].reverse())).toEqual(replay(alunos, partidas));
  });

  it("anular uma partida muda as seguintes; quem não jogou volta ao rating inicial", () => {
    const sem1 = replay(alunos, partidas.slice(1));
    expect(sem1.partidas.find((p) => p.id === "g3")).not.toEqual(replay(alunos, partidas).partidas[2]);
    const soG1 = replay(alunos, partidas.slice(0, 1));
    expect(soG1.alunos.find((x) => x.id === "c")).toEqual(jogadorInicial("c", "avancado"));
  });

  it("recusa partida com aluno de fora da turma", () => {
    expect(() => replay(alunos, [{ ...partidas[0], black_id: "intruso" }])).toThrow();
  });
});
