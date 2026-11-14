/**
 * Turma de demonstração: 1 professor, 10 alunos e 8 semanas de aula.
 * Rode com `pnpm db:seed` num banco limpo (`pnpm db:reset` faz as duas coisas).
 * As partidas passam pelo MESMO caminho do site (criarPartida + aplicarPartida).
 */
import { expectedScore, type Result } from "../src/lib/glicko";
import { NIVEIS, type Nivel } from "../src/lib/dominio";
import { aplicarPartida, criarPartida } from "../src/lib/partidas";
import { hashPin } from "../src/lib/pin";
import { jogadorInicial } from "../src/lib/rating";
import { supabaseAdmin } from "../src/lib/supabase/admin";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("127.0.0.1")) throw new Error("O seed só roda no Supabase local.");

const db = supabaseAdmin();
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

async function usuario(email: string, password?: string) {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`${email}: ${error.message} (banco já semeado? rode pnpm db:reset)`);
  return data.user.id;
}
const ok = <T,>(r: { data: T; error: unknown }) => {
  if (r.error) throw r.error;
  return r.data;
};

const professor = await usuario("prof@exemplo.com", "xadrez123");
ok(await db.from("teachers").insert({ id: professor, name: "Prof. Demo" }));
const turma = ok(
  await db.from("classes").insert({ teacher_id: professor, name: "Turma Demo — terça", join_code: "XADREZ" }).select("id").single(),
)!.id;

const ids: string[] = [];
for (const a of ALUNOS) {
  const id = await usuario(`${crypto.randomUUID()}@alunos.xadrez.local`);
  const j = jogadorInicial(id, a.nivel);
  ok(await db.from("students").insert({ id, class_id: turma, nickname: a.apelido, avatar: a.avatar, initial_level: a.nivel, rating: j.rating, rd: j.rd }));
  ok(await db.from("student_secrets").insert({ student_id: id, pin_hash: hashPin("1234") }));
  ids.push(id);
}

// um responsável para testar a área dos pais (entra por link no e-mail: veja o Mailpit)
const responsavel = await usuario("responsavel@exemplo.com");
ok(await db.from("guardians").insert({ id: responsavel, email: "responsavel@exemplo.com" }));
ok(await db.from("guardian_students").insert({ guardian_id: responsavel, student_id: ids[0] }));

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
  Professor:   prof@exemplo.com / xadrez123
  Alunos:      código XADREZ, PIN 1234 (todos). Ex.: Bia, Leo, Duda…
  Responsável: responsavel@exemplo.com (link de entrada chega no Mailpit: http://127.0.0.1:55324)
  Níveis: ${Object.values(NIVEIS).map((n) => `${n.rotulo} ${n.rating}`).join(" · ")}`);
