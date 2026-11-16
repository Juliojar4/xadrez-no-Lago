import "server-only";
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import type { Transaction } from "@libsql/client";
import { rodar, um } from "./db";

export const novoPin = () => String(randomInt(0, 10_000)).padStart(4, "0");

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

/** Grava (ou troca) o PIN do aluno / a senha do professor e zera as tentativas. */
export async function gravarSegredo(userId: string, segredo: string, tx?: Transaction) {
  const sql = `insert into secrets (user_id, hash) values (?, ?)
     on conflict (user_id) do update set hash = excluded.hash, failed_attempts = 0, locked_until = null`;
  const args = [userId, hashPin(segredo)];
  await (tx ? tx.execute({ sql, args }) : rodar(sql, args));
}

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60_000;

/**
 * Confere o PIN/senha. A tentativa é contada ANTES de conferir, num único UPDATE
 * (à prova de tentativas em paralelo). 5 erros seguidos → 15 minutos de bloqueio.
 */
export async function conferirSegredo(
  userId: string,
  segredo: string,
  agora = new Date(),
): Promise<"ok" | "errado" | "bloqueado"> {
  const linha = await um<{ hash: string }>(
    `update secrets set
       failed_attempts = case when locked_until is not null then 1 else failed_attempts + 1 end,
       locked_until = case when locked_until is null and failed_attempts + 1 >= ${MAX_TENTATIVAS} then :ate end
     where user_id = :id and (locked_until is null or locked_until < :agora)
     returning hash`,
    { id: userId, agora: agora.toISOString(), ate: new Date(agora.getTime() + BLOQUEIO_MS).toISOString() },
  );
  if (!linha) return "bloqueado";
  if (!conferePin(segredo, linha.hash)) return "errado";
  await rodar("update secrets set failed_attempts = 0, locked_until = null where user_id = ?", [userId]);
  return "ok";
}
