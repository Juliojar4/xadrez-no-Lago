/**
 * Dados de demonstração: o administrador, 2 cidades, 3 locais e 8 semanas de aula no primeiro.
 * Rode com `pnpm db:seed` num banco limpo (`pnpm db:reset` faz as duas coisas).
 * As partidas passam pelo MESMO caminho do site (criarPartida + aplicarPartida).
 */
import { randomUUID } from "node:crypto";
import { rodar, transacao, um } from "../src/lib/db";
import { expectedScore, type Result } from "../src/lib/glicko";
import { type Nivel } from "../src/lib/dominio";
import { aplicarPartida, criarPartida } from "../src/lib/partidas";
import { gravarPin, gravarSegredo } from "../src/lib/pin";
import { jogadorInicial } from "../src/lib/rating";

if (process.env.TURSO_DATABASE_URL) throw new Error("O seed só roda no banco local (tire TURSO_DATABASE_URL do ambiente).");
if (await um("select 1 from cities")) throw new Error("Banco já semeado. Rode pnpm db:reset.");

const DIA = 86_400_000;
const SEMANAS = 8;
const RODADAS = 5;

// sorteio com semente fixa: o seed dá sempre a mesma turma
let semente = 2026;
const sorteio = () => (semente = (semente * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;

// força "de verdade" de cada aluno (só para sortear resultados com cara de reais)
const ALUNOS: { apelido: string; nivel: Nivel; avatar: string; forca: number; entraNaSemana: number }[] = [
  { apelido: "Bia", nivel: "avancado", avatar: "dama-coral", forca: 1300, entraNaSemana: 0 },
  { apelido: "Leo", nivel: "avancado", avatar: "rei-azul", forca: 1150, entraNaSemana: 0 },
  { apelido: "Duda", nivel: "intermediario", avatar: "cavalo-roxo", forca: 1000, entraNaSemana: 0 },
  { apelido: "Kauã", nivel: "intermediario", avatar: "torre-verde", forca: 850, entraNaSemana: 0 },
  { apelido: "Malu", nivel: "intermediario", avatar: "bispo-laranja", forca: 780, entraNaSemana: 0 },
  { apelido: "Theo", nivel: "iniciante", avatar: "cavalo-petroleo", forca: 650, entraNaSemana: 0 },
  { apelido: "Nina", nivel: "iniciante", avatar: "peao-coral", forca: 520, entraNaSemana: 0 },
  { apelido: "Caio", nivel: "iniciante", avatar: "torre-azul", forca: 400, entraNaSemana: 0 },
  // chegaram agora: ficam na lista de Novatos
  { apelido: "Lia", nivel: "iniciante", avatar: "dama-verde", forca: 600, entraNaSemana: 6 },
  { apelido: "Gui", nivel: "intermediario", avatar: "rei-laranja", forca: 900, entraNaSemana: 7 },
];

await gravarSegredo("admin", "admin123");

async function cidade(nome: string, senha: string) {
  const id = randomUUID();
  await rodar("insert into cities (id, name) values (?, ?)", [id, nome]);
  await gravarSegredo(id, senha);
  return id;
}
async function local(cityId: string, nome: string) {
  const id = randomUUID();
  await rodar("insert into classes (id, city_id, name) values (?, ?, ?)", [id, cityId, nome]);
  return id;
}
async function aluno(classId: string, a: { apelido: string; nivel: Nivel; avatar: string }, pin: string) {
  const id = randomUUID();
  const j = jogadorInicial(id, a.nivel);
  await transacao(async (tx) => {
    await tx.execute({
      sql: "insert into students (id, class_id, nickname, avatar, initial_level, rating, rd) values (?, ?, ?, ?, ?, ?, ?)",
      args: [id, classId, a.apelido, a.avatar, a.nivel, j.rating, j.rd],
    });
    await gravarPin(tx, id, classId, pin);
  });
  return id;
}

const professor = await cidade("Brasília", "xadrez123");
const turma = await local(professor, "Escola do Lago");
const clube = await local(professor, "Clube de Xadrez");
const goiania = await cidade("Goiânia", "xadrez123");
const praca = await local(goiania, "Praça do Xadrez"); // cidade com um local só: o aluno cai direto no PIN

// PINs 1001, 1002, … na ordem da lista
const ids: string[] = [];
for (const [i, a] of ALUNOS.entries()) ids.push(await aluno(turma, a, String(1001 + i)));
await aluno(clube, { apelido: "Rafa", nivel: "intermediario", avatar: "rei-roxo" }, "2001");
await aluno(clube, { apelido: "Sofia", nivel: "iniciante", avatar: "dama-azul" }, "2002");
await aluno(praca, { apelido: "Davi", nivel: "avancado", avatar: "torre-coral" }, "3001");
await aluno(praca, { apelido: "Luna", nivel: "iniciante", avatar: "bispo-verde" }, "3002");

// 8 aulas semanais (a última foi ontem), 5 rodadas por aula, pares sorteados
let total = 0;
const ontem = Date.now() - DIA;
for (let semana = 0; semana < SEMANAS; semana++) {
  const aula = ontem - (SEMANAS - 1 - semana) * 7 * DIA;
  const presentes = ALUNOS.map((_, i) => i).filter((i) => ALUNOS[i].entraNaSemana <= semana);
  for (let rodada = 0; rodada < RODADAS; rodada++) {
    const ordem = [...presentes].sort(() => sorteio() - 0.5);
    for (let k = 0; k + 1 < ordem.length; k += 2) {
      const [w, b] = [ordem[k], ordem[k + 1]];
      const chance = expectedScore(ALUNOS[w].forca, ALUNOS[b].forca, 0);
      const x = sorteio();
      const score: Result = x < 0.1 ? 0.5 : sorteio() < chance ? 1 : 0;
      const id = await criarPartida({ classId: turma, whiteId: ids[w], blackId: ids[b], whiteScore: score, reportedBy: professor });
      await aplicarPartida(id, professor, new Date(aula + rodada * 12 * 60_000 + k * 1000));
      total++;
    }
  }
}

// uma partida esperando confirmação: Leo diz que ganhou da Bia
await criarPartida({ classId: turma, whiteId: ids[1], blackId: ids[0], whiteScore: 1, reportedBy: ids[1] });

console.log(`Pronto: 2 cidades, 3 locais, ${ALUNOS.length + 4} alunos, ${total} partidas confirmadas e 1 pendente.
  Administrador: senha admin123
  Professores:   Brasília e Goiânia, senha xadrez123
  Alunos (só o PIN):
    Brasília · Escola do Lago:  ${ALUNOS.map((a, i) => `${a.apelido} ${1001 + i}`).join(", ")}
    Brasília · Clube de Xadrez: Rafa 2001, Sofia 2002
    Goiânia · Praça do Xadrez:  Davi 3001, Luna 3002`);
