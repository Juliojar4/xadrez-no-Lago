import type { Result } from "./glicko";

export const PIN_DIGITOS = 4;

export const NIVEIS = {
  iniciante: { rotulo: "Iniciante", rating: 400 },
  intermediario: { rotulo: "Intermediário", rating: 800 },
  avancado: { rotulo: "Avançado", rating: 1200 },
} as const;
export type Nivel = keyof typeof NIVEIS;
export const ehNivel = (v: unknown): v is Nivel => typeof v === "string" && v in NIVEIS;

// Avatares 100% ilustrados: uma peça + uma cor. Nada de foto.
export const PECAS = { rei: "♚", dama: "♛", torre: "♜", bispo: "♝", cavalo: "♞", peao: "♟" } as const;
export const CORES = {
  roxo: "#5b2be0",
  coral: "#d6336c",
  laranja: "#c2410c",
  verde: "#15803d",
  azul: "#1d4ed8",
  petroleo: "#0f766e",
} as const;
export const AVATARES = Object.keys(PECAS).flatMap((p) => Object.keys(CORES).map((c) => `${p}-${c}`));
export const ehAvatar = (v: unknown): v is string => typeof v === "string" && AVATARES.includes(v);

export const ehResultado = (v: number): v is Result => v === 1 || v === 0.5 || v === 0;

/** "1 × 0", "½ × ½", "0 × 1" (brancas × pretas) */
export const placar = (whiteScore: number) =>
  whiteScore === 1 ? "1 × 0" : whiteScore === 0 ? "0 × 1" : "½ × ½";

export const comSinal = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/** Mensagens mostradas a partir de `?erro=` / `?ok=` na URL (só códigos conhecidos viram texto). */
export const MENSAGENS = {
  iguais: "Escolha dois jogadores diferentes.",
  turma: "Os dois jogadores precisam ser da mesma turma.",
  resolvida: "Essa partida já foi resolvida.",
  dados: "Faltou preencher alguma coisa. Confere e tenta de novo.",
  pin: "PIN errado. Tenta de novo com calma!",
  bloqueado: "Muitas tentativas. Espere 15 minutos e tente de novo.",
  nome: "Esse nome já existe ou é curto demais (mínimo 2 letras).",
  criado: "Criado!",
  senhaTrocada: "Senha trocada.",
  login: "A senha não confere.",
  senha: "A senha precisa ter 8 letras ou mais, e as duas precisam ser iguais.",
  registrada: "Partida registrada! O rating já mudou.",
  enviada: "Enviado! Agora seu adversário precisa confirmar.",
  confirmada: "Partida confirmada! O rating já mudou.",
  recusada: "Partida recusada. Nada mudou no rating.",
  anulada: "Partida anulada. O rating da turma foi recalculado.",
} as const;
export type CodigoMensagem = keyof typeof MENSAGENS;
export const mensagem = (codigo: unknown) =>
  typeof codigo === "string" && codigo in MENSAGENS ? MENSAGENS[codigo as CodigoMensagem] : null;

/** Só aceita caminho interno ("/algo"), nunca outro site. */
export const destinoSeguro = (v: unknown, padrao = "/turma") =>
  typeof v === "string" && /^\/(?!\/)[\w\-/?=&]*$/.test(v) ? v : padrao;
