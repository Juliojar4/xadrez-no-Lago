/**
 * Dados de demonstração: o professor, a turma, 10 alunos e 8 semanas de aula.
 * Rode com `pnpm db:seed` num banco limpo (`pnpm db:reset` faz as duas coisas).
 * As partidas passam pelo MESMO caminho do site (criarPartida + aplicarPartida).
 */
import { randomUUID } from "node:crypto";
import { rodar, um } from "../src/lib/db";
import { expectedScore, type Result } from "../src/lib/glicko";
import { NIVEIS, type Nivel } from "../src/lib/dominio";
import { aplicarPartida, criarPartida } from "../src/lib/partidas";
import { gravarSegredo } from "../src/lib/pin";
import { jogadorInicial } from "../src/lib/rating";

if (await um("select 1 from teachers")) throw new Error("Banco já semeado. Rode pnpm db:reset.");

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

const professor = randomUUID();
const turma = randomUUID();
await rodar("insert into teachers (id, name) values (?, 'Professor')", [professor]);
await rodar("insert into classes (id, teacher_id, name, join_code) values (?, ?, 'Turma', 'XADREZ')", [turma, professor]);
await gravarSegredo(professor, "xadrez123");

const ids: string[] = [];
for (const a of ALUNOS) {
  const id = randomUUID();
  const j = jogadorInicial(id, a.nivel);
  await rodar("insert into students (id, class_id, nickname, avatar, initial_level, rating, rd) values (?, ?, ?, ?, ?, ?, ?)", [
    id, turma, a.apelido, a.avatar, a.nivel, j.rating, j.rd,
  ]);
  await gravarSegredo(id, "1234");
  ids.push(id);
}

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

console.log(`Pronto: ${ALUNOS.length} alunos, ${total} partidas confirmadas e 1 pendente.
  Professor: senha xadrez123
  Alunos:    código XADREZ, PIN 1234 (todos). Ex.: Bia, Leo, Duda…
  Níveis: ${Object.values(NIVEIS).map((n) => `${n.rotulo} ${n.rating}`).join(" · ")}`);
