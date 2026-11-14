/**
 * Glicko-1 para ranking de xadrez infantil
 * ---------------------------------------
 * Mesma família de sistema que o chess.com usa (Glicko, de Mark Glickman).
 * Cada jogador tem:
 *   - rating: a força estimada (ex.: 800)
 *   - rd:     "Rating Deviation" — o quanto o sistema ainda NÃO tem certeza
 *             do rating. Começa alto (350) e cai conforme o aluno joga.
 *             RD alto => ganha/perde muitos pontos; RD baixo => muda pouco.
 *   - lastPlayedAt: usado para o RD voltar a subir quando o aluno fica
 *             parado (férias, faltas), igual ao chess.com.
 *
 * Atualização partida a partida (como o chess.com faz: o rating muda logo
 * após cada jogo). Os dois jogadores são atualizados com os valores de
 * ANTES da partida, para o cálculo ser justo para ambos.
 */

export type Result = 1 | 0.5 | 0; // vitória, empate, derrota (do ponto de vista do jogador A)

export interface Player {
  id: string;
  rating: number;
  rd: number;
  lastPlayedAt: Date | null;
  gamesPlayed: number;
}

export interface GlickoConfig {
  initialRating: number;   // rating inicial
  initialRd: number;       // incerteza inicial (máx.)
  minRd: number;           // piso do RD — evita que o rating "congele"
  maxRd: number;
  ratingFloor: number;     // rating mínimo (chess.com usa 100)
  /** dias parado para o RD de um jogador "estável" voltar ao máximo */
  daysToFullUncertainty: number;
  /** RD acima disso = rating "provisório" (mostrar com "?" e fora do ranking) */
  provisionalRd: number;
}

export const DEFAULT_CONFIG: GlickoConfig = {
  initialRating: 800,
  initialRd: 350,
  minRd: 50,
  maxRd: 350,
  ratingFloor: 100,
  // 1000 dias: o RD sobe devagar com a inatividade, como no chess.com.
  // Com 180, uma turma de aula semanal nunca saía do provisório (ver DECISOES.md).
  daysToFullUncertainty: 1000,
  provisionalRd: 110,
};

const Q = Math.log(10) / 400;
const PI2 = Math.PI * Math.PI;

/** Fator que "desconta" o peso de um adversário cujo rating é incerto */
function g(rd: number): number {
  return 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / PI2);
}

/** Chance esperada de A vencer B (0 a 1) */
export function expectedScore(rA: number, rB: number, rdB: number): number {
  return 1 / (1 + Math.pow(10, (-g(rdB) * (rA - rB)) / 400));
}

/** Constante c derivada de "quantos dias até o RD voltar ao máximo" */
function cFromConfig(cfg: GlickoConfig): number {
  return Math.sqrt((cfg.maxRd ** 2 - cfg.minRd ** 2) / cfg.daysToFullUncertainty);
}

/** RD aumenta com o tempo sem jogar */
export function rdAfterInactivity(p: Player, now: Date, cfg = DEFAULT_CONFIG): number {
  if (!p.lastPlayedAt) return Math.min(p.rd, cfg.maxRd);
  const days = Math.max(0, (now.getTime() - p.lastPlayedAt.getTime()) / 86_400_000);
  const c = cFromConfig(cfg);
  return Math.min(Math.sqrt(p.rd ** 2 + c * c * days), cfg.maxRd);
}

function updateOne(
  r: number, rd: number,
  rOpp: number, rdOpp: number,
  score: Result,
  cfg: GlickoConfig,
): { rating: number; rd: number } {
  const gOpp = g(rdOpp);
  const E = expectedScore(r, rOpp, rdOpp);
  const d2 = 1 / (Q * Q * gOpp * gOpp * E * (1 - E));
  const denom = 1 / (rd * rd) + 1 / d2;

  const newRating = r + (Q / denom) * gOpp * (score - E);
  const newRd = Math.sqrt(1 / denom);

  return {
    rating: Math.max(cfg.ratingFloor, newRating),
    rd: Math.min(cfg.maxRd, Math.max(cfg.minRd, newRd)),
  };
}

export interface GameOutcome {
  a: Player;
  b: Player;
  deltaA: number; // pontos ganhos/perdidos (arredondado, para mostrar na tela)
  deltaB: number;
}

/**
 * Registra uma partida entre A e B.
 * scoreA: 1 = A venceu, 0.5 = empate, 0 = B venceu.
 * Retorna cópias atualizadas (não altera os objetos originais).
 */
export function recordGame(
  a: Player, b: Player, scoreA: Result,
  playedAt = new Date(), cfg = DEFAULT_CONFIG,
): GameOutcome {
  // 1) aplica a inatividade de cada um antes do jogo
  const rdA = rdAfterInactivity(a, playedAt, cfg);
  const rdB = rdAfterInactivity(b, playedAt, cfg);

  // 2) calcula os dois com os valores de ANTES da partida
  const newA = updateOne(a.rating, rdA, b.rating, rdB, scoreA, cfg);
  const newB = updateOne(b.rating, rdB, a.rating, rdA, (1 - scoreA) as Result, cfg);

  const updatedA: Player = { ...a, ...newA, lastPlayedAt: playedAt, gamesPlayed: a.gamesPlayed + 1 };
  const updatedB: Player = { ...b, ...newB, lastPlayedAt: playedAt, gamesPlayed: b.gamesPlayed + 1 };

  return {
    a: updatedA,
    b: updatedB,
    deltaA: Math.round(newA.rating) - Math.round(a.rating),
    deltaB: Math.round(newB.rating) - Math.round(b.rating),
  };
}

/** Prévia "se ganhar +X / empatar +Y / perder -Z" — ótimo para mostrar antes da partida */
export function previewDeltas(a: Player, b: Player, now = new Date(), cfg = DEFAULT_CONFIG) {
  const res = (s: Result) => recordGame(a, b, s, now, cfg).deltaA;
  return { win: res(1), draw: res(0.5), loss: res(0) };
}

export function isProvisional(p: Player, now = new Date(), cfg = DEFAULT_CONFIG): boolean {
  return rdAfterInactivity(p, now, cfg) > cfg.provisionalRd;
}

/** Intervalo de 95% de confiança: "seu rating real está entre X e Y" */
export function confidenceInterval(p: Player, now = new Date(), cfg = DEFAULT_CONFIG): [number, number] {
  const rd = rdAfterInactivity(p, now, cfg);
  return [Math.round(p.rating - 1.96 * rd), Math.round(p.rating + 1.96 * rd)];
}

export function newPlayer(id: string, cfg = DEFAULT_CONFIG, rating = cfg.initialRating): Player {
  return { id, rating, rd: cfg.initialRd, lastPlayedAt: null, gamesPlayed: 0 };
}

/**
 * Ranking: só entra quem não é provisório e jogou recentemente.
 * Provisórios aparecem numa lista separada ("Novatos").
 */
export function buildLeaderboard(players: Player[], now = new Date(), cfg = DEFAULT_CONFIG, activeDays = 30) {
  const active = (p: Player) =>
    p.lastPlayedAt !== null && (now.getTime() - p.lastPlayedAt.getTime()) / 86_400_000 <= activeDays;

  const ranked = players
    .filter((p) => active(p) && !isProvisional(p, now, cfg))
    .sort((x, y) => y.rating - x.rating)
    .map((p, i) => ({ position: i + 1, id: p.id, rating: Math.round(p.rating) }));

  const newcomers = players
    .filter((p) => isProvisional(p, now, cfg))
    .map((p) => ({ id: p.id, rating: `${Math.round(p.rating)}?`, gamesPlayed: p.gamesPlayed }));

  return { ranked, newcomers };
}
