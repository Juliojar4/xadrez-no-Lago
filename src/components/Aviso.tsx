import { mensagem } from "@/lib/dominio";

/** Mostra a mensagem de `?ok=` ou `?erro=` da URL (só códigos conhecidos). */
export function Aviso({ ok, erro }: { ok?: string | string[]; erro?: string | string[] }) {
  const textoErro = mensagem(erro);
  const texto = textoErro ?? mensagem(ok);
  if (!texto) return null;
  return (
    <p
      role={textoErro ? "alert" : "status"}
      className={`mb-4 rounded-2xl border-2 px-4 py-3 font-bold ${
        textoErro ? "border-coral bg-coral-claro text-[#8a1640]" : "border-menta bg-menta-clara text-[#0b4f49]"
      }`}
    >
      {texto}
    </p>
  );
}
