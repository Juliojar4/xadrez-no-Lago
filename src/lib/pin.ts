import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

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
