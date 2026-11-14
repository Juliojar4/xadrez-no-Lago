import type { Metadata } from "next";
import { criarContaProfessor, entrarProfessor } from "../../acoes";
import { Aviso } from "@/components/Aviso";
import { Enviar } from "@/components/Enviar";

export const metadata: Metadata = { title: "Professor" };

export default async function EntrarProfessor({ searchParams }: PageProps<"/professor/entrar">) {
  const sp = await searchParams;
  return (
    <div className="mx-auto grid max-w-md gap-5">
      <Aviso erro={sp.erro === "confirme" ? undefined : sp.erro} ok={sp.erro === "confirme" ? "confirme" : undefined} />
      <form action={entrarProfessor} className="cartao grid gap-4">
        <h1 className="text-3xl">Entrar como professor</h1>
        <label className="grid gap-1 font-bold">
          E-mail
          <input name="email" type="email" required autoComplete="email" className="campo" />
        </label>
        <label className="grid gap-1 font-bold">
          Senha
          <input name="senha" type="password" required autoComplete="current-password" className="campo" />
        </label>
        <Enviar>Entrar</Enviar>
      </form>

      <details className="cartao">
        <summary className="min-h-11 cursor-pointer content-center font-display text-xl font-extrabold">
          Ainda não tenho conta
        </summary>
        <form action={criarContaProfessor} className="mt-3 grid gap-4">
          <label className="grid gap-1 font-bold">
            Seu nome
            <input name="nome" required maxLength={80} autoComplete="name" className="campo" />
          </label>
          <label className="grid gap-1 font-bold">
            E-mail
            <input name="email" type="email" required autoComplete="email" className="campo" />
          </label>
          <label className="grid gap-1 font-bold">
            Senha (8 letras ou mais)
            <input name="senha" type="password" required minLength={8} autoComplete="new-password" className="campo" />
          </label>
          <Enviar>Criar conta</Enviar>
        </form>
      </details>
    </div>
  );
}
