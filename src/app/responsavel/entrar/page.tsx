import type { Metadata } from "next";
import { entrarResponsavel } from "../../acoes";
import { Aviso } from "@/components/Aviso";
import { Enviar } from "@/components/Enviar";

export const metadata: Metadata = { title: "Área do responsável" };

export default async function EntrarResponsavel({ searchParams }: PageProps<"/responsavel/entrar">) {
  const sp = await searchParams;
  return (
    <form action={entrarResponsavel} className="cartao mx-auto grid max-w-md gap-4">
      <h1 className="text-3xl">Área do responsável</h1>
      <p className="text-tinta-suave">
        Digite o e-mail que o professor cadastrou. Enviaremos um link para você entrar, sem senha.
      </p>
      <Aviso ok={sp.ok} erro={sp.erro} />
      <label className="grid gap-1 font-bold">
        E-mail
        <input name="email" type="email" required autoComplete="email" className="campo" />
      </label>
      <Enviar>Receber link de entrada</Enviar>
    </form>
  );
}
