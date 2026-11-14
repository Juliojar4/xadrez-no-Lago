import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  buildLeaderboard,
  confidenceInterval,
  expectedScore,
  isProvisional,
  newPlayer,
  previewDeltas,
  rdAfterInactivity,
  recordGame,
  type Player,
} from "./glicko";

const T = new Date("2026-03-01T12:00:00Z");
const DIA = 86_400_000;
const jogador = (p: Partial<Player>): Player => ({ id: "x", rating: 800, rd: 350, lastPlayedAt: null, gamesPlayed: 0, ...p });

describe("matemática do Glicko-1", () => {
  it("chance esperada bate com o exemplo do artigo do Glickman", () => {
    // jogador 1500 contra (1400, RD 30), (1550, RD 100) e (1700, RD 300)
    expect(expectedScore(1500, 1400, 30)).toBeCloseTo(0.639, 3);
    expect(expectedScore(1500, 1550, 100)).toBeCloseTo(0.432, 3);
    expect(expectedScore(1500, 1700, 300)).toBeCloseTo(0.303, 3);
  });

  it("uma partida: 1500/RD200 vence 1400/RD30 (conferido à mão pela fórmula)", () => {
    const o = recordGame(jogador({ id: "a", rating: 1500, rd: 200 }), jogador({ id: "b", rating: 1400, rd: 30 }), 1, T);
    expect(o.a.rating).toBeCloseTo(1563.4320485812902, 9);
    expect(o.a.rd).toBeCloseTo(175.22023356952303, 9);
    expect(o.b.rating).toBeCloseTo(1398.342512471733, 9);
    expect(o.b.rd).toBe(50); // piso do RD
  });

  // Valores "de ouro": se alguém refatorar o módulo, os resultados têm de continuar idênticos.
  it("dois novatos: 800 vence 1200", () => {
    const o = recordGame(newPlayer("a", DEFAULT_CONFIG, 800), newPlayer("b", DEFAULT_CONFIG, 1200), 1, T);
    expect(o.a.rating).toBeCloseTo(1107.3872278483077, 9);
    expect(o.b.rating).toBeCloseTo(892.6127721516923, 9);
    expect(o.a.rd).toBeCloseTo(311.30378112463205, 9);
    expect(o.b.rd).toBeCloseTo(311.30378112463205, 9);
    expect([o.deltaA, o.deltaB]).toEqual([307, -307]);
  });

  it("os dois lados usam os valores de ANTES da partida e nada é mutado", () => {
    const a = jogador({ id: "a", rating: 900, rd: 120 });
    const b = jogador({ id: "b", rating: 1000, rd: 80 });
    const copia = structuredClone({ a, b });
    const ab = recordGame(a, b, 1, T);
    const ba = recordGame(b, a, 0, T);
    expect(ab.a).toEqual(ba.b);
    expect(ab.b).toEqual(ba.a);
    expect({ a, b }).toEqual(copia);
    expect(ab.a.gamesPlayed).toBe(1);
    expect(ab.a.lastPlayedAt).toEqual(T);
  });

  it("ganhar sobe, perder desce, empatar com alguém mais forte sobe", () => {
    const fraco = jogador({ id: "a", rating: 600, rd: 100 });
    const forte = jogador({ id: "b", rating: 1000, rd: 100 });
    const p = previewDeltas(fraco, forte, T);
    expect(p.win).toBeGreaterThan(p.draw);
    expect(p.draw).toBeGreaterThan(0);
    expect(p.loss).toBeLessThan(0);
  });

  it("respeita o piso do rating e os limites do RD", () => {
    const o = recordGame(jogador({ id: "a", rating: 100, rd: 350 }), jogador({ id: "b", rating: 100, rd: 350 }), 0, T);
    expect(o.a.rating).toBe(DEFAULT_CONFIG.ratingFloor);
    expect(o.a.rd).toBeLessThanOrEqual(DEFAULT_CONFIG.maxRd);
    expect(o.b.rd).toBeGreaterThanOrEqual(DEFAULT_CONFIG.minRd);
  });
});

describe("inatividade e rating provisório", () => {
  const parado = jogador({ id: "e", rating: 900, rd: 60, lastPlayedAt: new Date(T.getTime() - 30 * DIA), gamesPlayed: 40 });

  it("o RD sobe devagar com o tempo parado e nunca passa do máximo", () => {
    expect(rdAfterInactivity(parado, T)).toBeCloseTo(84.8528137423857, 9); // sqrt(60² + 120·30)
    expect(rdAfterInactivity(parado, new Date(T.getTime() + 5000 * DIA))).toBe(DEFAULT_CONFIG.maxRd);
    expect(rdAfterInactivity(jogador({ rd: 200 }), T)).toBe(200); // nunca jogou: não infla
  });

  it("a inatividade entra no cálculo da partida", () => {
    const o = recordGame(parado, jogador({ id: "d", rating: 1398.342512471733, rd: 50, gamesPlayed: 51 }), 0.5, T);
    expect(o.a.rating).toBeCloseTo(917.97363371762, 9);
    expect(o.a.rd).toBeCloseTo(84.33945842314508, 9);
  });

  it("provisório é RD > 110 (contando a inatividade)", () => {
    expect(isProvisional(jogador({ rd: 110 }), T)).toBe(false);
    expect(isProvisional(jogador({ rd: 110.01 }), T)).toBe(true);
    expect(isProvisional(parado, T)).toBe(false);
    expect(isProvisional(parado, new Date(T.getTime() + 61 * DIA))).toBe(true);
  });

  it("prévia e intervalo de confiança", () => {
    expect(previewDeltas(parado, jogador({ id: "d", rating: 1400, rd: 30 }), T)).toEqual({ win: 39, draw: 18, loss: -2 });
    expect(confidenceInterval(parado, T)).toEqual([734, 1066]);
  });
});

describe("ranking", () => {
  it("provisórios vão para Novatos com '?', firmes e ativos vão para o ranking em ordem", () => {
    const ontem = new Date(T.getTime() - DIA);
    const { ranked, newcomers } = buildLeaderboard(
      [
        jogador({ id: "novato", rating: 812.4, rd: 300, lastPlayedAt: ontem, gamesPlayed: 2 }),
        jogador({ id: "b", rating: 950, rd: 70, lastPlayedAt: ontem }),
        jogador({ id: "a", rating: 1100.6, rd: 70, lastPlayedAt: ontem }),
        jogador({ id: "sumido", rating: 1500, rd: 50, lastPlayedAt: new Date(T.getTime() - 40 * DIA) }),
      ],
      T,
    );
    expect(ranked).toEqual([
      { position: 1, id: "a", rating: 1101 },
      { position: 2, id: "b", rating: 950 },
    ]);
    expect(newcomers).toEqual([{ id: "novato", rating: "812?", gamesPlayed: 2 }]);
  });
});
