import { CORES, PECAS } from "@/lib/dominio";

/** Avatar ilustrado: uma peça de xadrez sobre uma cor. Decorativo (o apelido vem sempre ao lado). */
export function Avatar({ chave, tamanho = 48 }: { chave: string; tamanho?: number }) {
  const [peca, cor] = chave.split("-") as [keyof typeof PECAS, keyof typeof CORES];
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-full text-white"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.6, lineHeight: 1, background: CORES[cor] ?? CORES.roxo }}
    >
      {PECAS[peca] ?? PECAS.peao}
    </span>
  );
}
