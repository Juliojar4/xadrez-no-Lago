import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { criarSenhaProfessor, entrarProfessor } from "../../acoes";
import { Aviso } from "@/components/Aviso";
import { Enviar } from "@/components/Enviar";
import { getViewer } from "@/lib/sessao";
import { um } from "@/lib/db";

export const metadata: Metadata = { title: "Professor" };

export default async function EntrarProfessor({ searchParams }: PageProps<"/professor/entrar">) {
  const [sp, v] = await Promise.all([searchParams, getViewer()]);
  if (v?.tipo === "professor") redirect("/professor");
  // O site tem um professor só. Enquanto ele não existe, esta tela cria a senha dele.
  if (!(await um("select 1 from teachers")))
    return (
      <form action={criarSenhaProfessor} className="cartao mx-auto grid max-w-md gap-4">
        <h1 className="text-3xl">Bem-vindo, professor!</h1>
        <p className="text-tinta-suave">
          Crie a senha do professor. Guarde bem: não há e-mail para recuperar. Depois é só cadastrar os alunos.
        </p>
        <Aviso erro={sp.erro} />
        <label className="grid gap-1 font-bold">
          Senha (8 letras ou mais)
          <input name="senha" type="password" required minLength={8} autoComplete="new-password" className="campo" />
        </label>
        <label className="grid gap-1 font-bold">
          Repita a senha
          <input name="confirmar" type="password" required minLength={8} autoComplete="new-password" className="campo" />
        </label>
        <Enviar>Criar senha e começar</Enviar>
      </form>
    );

  return (
    <form action={entrarProfessor} className="cartao mx-auto grid max-w-md gap-4">
      <h1 className="text-3xl">Entrar como professor</h1>
      <Aviso erro={sp.erro} />
      <label className="grid gap-1 font-bold">
        Senha
        <input name="senha" type="password" required autoFocus autoComplete="current-password" className="campo" />
      </label>
      <Enviar>Entrar</Enviar>
    </form>
  );
}
