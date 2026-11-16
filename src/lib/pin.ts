import "server-only";
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import type { Transaction } from "@libsql/client";
import { rodar, um } from "./db";
import { PIN_DIGITOS } from "./dominio";

export const novoPin = () => String(randomInt(0, 10 ** PIN_DIGITOS)).padStart(PIN_DIGITOS, "0");

export function hashPin(pin: string): string {
  const sal = randomBytes(16);
  return `${sal.toString("hex")}:${scryptSync(pin, sal, 32).toString("hex")}`;
}

export function conferePin(pin: string, guardado: string): boolean {
  const [sal, hash] = guardado.split(":");
  if (!sal || !hash) return false;
  const esperado = Buffer.from(hash, "hex");
  return timingSafeEqual(scryptSync(pin, Buffer.from(sal, "hex"), esperado.length), esperado);
}

// ───────────────────────── Tentativas ─────────────────────────

const BLOQUEIO_MS = 15 * 60_000;

/**
 * Conta a tentativa ANTES de conferir, num único comando (à prova de tentativas em
 * paralelo). `max` erros seguidos → 15 minutos de bloqueio. Devolve false se bloqueado.
 */
async function contarTentativa(chave: string, max: number, agora: Date) {
  const linha = await um(
    `insert into attempts (key, failed_attempts) values (:chave, 1)
     on conflict (key) do update set
       failed_attempts = case when locked_until is not null then 1 else failed_attempts + 1 end,
       locked_until = case when locked_until is null and failed_attempts + 1 >= :max then :ate end
     where locked_until is null or locked_until < :agora
     returning 1`,
    { chave, max, agora: agora.toISOString(), ate: new Date(agora.getTime() + BLOQUEIO_MS).toISOString() },
  );
  return Boolean(linha);
}
const zerarTentativas = (chave: string) => rodar("delete from attempts where key = ?", [chave]);

// ───────────────────────── Senhas (admin e professor) ─────────────────────────

/** Grava (ou troca) a senha do administrador ('admin') ou do professor de uma cidade. */
export async function gravarSegredo(userId: string, senha: string, tx?: Transaction) {
  const sql = `insert into secrets (user_id, hash) values (?, ?)
     on conflict (user_id) do update set hash = excluded.hash`;
  const args = [userId, hashPin(senha)];
  await (tx ? tx.execute({ sql, args }) : rodar(sql, args));
  if (!tx) await zerarTentativas(`u:${userId}`);
}

/** Confere a senha. 5 erros seguidos bloqueiam aquela conta por 15 minutos. */
export async function conferirSegredo(
  userId: string,
  senha: string,
  agora = new Date(),
): Promise<"ok" | "errado" | "bloqueado"> {
  const chave = `u:${userId}`;
  if (!(await contarTentativa(chave, 5, agora))) return "bloqueado";
  const linha = await um<{ hash: string }>("select hash from secrets where user_id = ? and class_id is null", [userId]);
  if (!linha || !conferePin(senha, linha.hash)) return "errado";
  await zerarTentativas(chave);
  return "ok";
}

// ───────────────────────── PIN do aluno ─────────────────────────

// O sal é o local: o mesmo PIN em locais diferentes dá hashes diferentes, e dentro do
// local dá para procurar o dono do PIN com uma conta só.
const chavePin = (classId: string, pin: string) => scryptSync(pin, classId, 32).toString("hex");

/**
 * Dá um PIN ao aluno (sorteado, ou o `pin` pedido) que ninguém mais usa naquele local.
 * Roda dentro de uma transação de escrita, então a checagem não tem corrida.
 */
export async function gravarPin(tx: Transaction, studentId: string, classId: string, pin?: string) {
  for (let i = 0; i < 50; i++) {
    const tentativa = pin ?? novoPin();
    const hash = chavePin(classId, tentativa);
    const ocupado = await tx.execute({
      sql: "select 1 from secrets where class_id = ? and hash = ? and user_id <> ?",
      args: [classId, hash, studentId],
    });
    if (ocupado.rows.length) {
      if (pin) break;
      continue;
    }
    await tx.execute({
      sql: `insert into secrets (user_id, class_id, hash) values (?, ?, ?)
            on conflict (user_id) do update set class_id = excluded.class_id, hash = excluded.hash`,
      args: [studentId, classId, hash],
    });
    return tentativa;
  }
  throw new Error("não achei um PIN livre para este local");
}

/**
 * Login do aluno: só o PIN, dentro de um local. Devolve o id do aluno.
 * 10 erros seguidos vindos do mesmo endereço (IP) bloqueiam aquele endereço, naquele
 * local, por 15 minutos. É por IP (e não por local) para ninguém de fora travar a turma.
 */
export async function entrarComPin(
  classId: string,
  pin: string,
  ip: string,
  agora = new Date(),
): Promise<{ id: string } | "errado" | "bloqueado"> {
  const chave = `pin:${classId}:${ip}`;
  if (!(await contarTentativa(chave, 10, agora))) return "bloqueado";
  const aluno = await um<{ id: string }>(
    `select s.id from secrets x join students s on s.id = x.user_id
     where x.class_id = ? and x.hash = ? and s.class_id = x.class_id and s.active = 1`,
    [classId, chavePin(classId, pin)],
  );
  if (!aluno) return "errado";
  await zerarTentativas(chave);
  return aluno;
}
