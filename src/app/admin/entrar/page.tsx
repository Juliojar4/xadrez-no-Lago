import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { criarSenhaAdmin, entrarAdmin } from "../../acoes";
import { Aviso } from "@/components/Aviso";
import { Enviar } from "@/components/Enviar";
import { um } from "@/lib/db";
import { getViewer } from "@/lib/sessao";

export const metadata: Metadata = { title: "Administração" };

export default async function EntrarAdmin({ searchParams }: PageProps<"/admin/entrar">) {
  const [sp, v] = await Promise.all([searchParams, getViewer()]);
  if (v?.tipo === "admin") redirect("/admin");

  // Enquanto o administrador não existe, esta tela cria a senha dele.
  if (!(await um("select 1 from secrets where user_id = 'admin'")))
    return (
      <form action={criarSenhaAdmin} className="cartao mx-auto grid max-w-md gap-4">
        <h1 className="text-3xl">Bem-vindo, administrador!</h1>
        <p className="text-tinta-suave">
          Crie a senha de administrador. Guarde bem: não há e-mail para recuperar. Com ela você cria as cidades e a
          senha do professor de cada uma.
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
    <form action={entrarAdmin} className="cartao mx-auto grid max-w-md gap-4">
      <h1 className="text-3xl">Administração</h1>
      <Aviso erro={sp.erro} />
      <label className="grid gap-1 font-bold">
        Senha
        <input name="senha" type="password" required autoFocus autoComplete="current-password" className="campo" />
      </label>
      <Enviar>Entrar</Enviar>
    </form>
  );
}
