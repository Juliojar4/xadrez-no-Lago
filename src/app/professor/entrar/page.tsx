import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { entrarProfessor } from "../../acoes";
import { Aviso } from "@/components/Aviso";
import { Enviar } from "@/components/Enviar";
import { cidades } from "@/lib/consultas";
import { getViewer } from "@/lib/sessao";

export const metadata: Metadata = { title: "Professor" };

export default async function EntrarProfessor({ searchParams }: PageProps<"/professor/entrar">) {
  const [sp, v] = await Promise.all([searchParams, getViewer()]);
  if (v?.tipo === "professor") redirect("/professor");
  const todas = await cidades();
  const cidade = todas.find((c) => c.id === sp.cidade) ?? (todas.length === 1 ? todas[0] : undefined);

  if (!cidade)
    return (
      <div className="grid gap-4">
        <h1 className="text-3xl">Professor de qual cidade?</h1>
        {todas.length === 0 && (
          <p className="cartao">
            Ainda não há cidades. O administrador cria as cidades e a senha de cada professor em{" "}
            <Link href="/admin" className="font-bold text-roxo-escuro underline">
              Administração
            </Link>
            .
          </p>
        )}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {todas.map((c) => (
            <li key={c.id}>
              <Link
                href={`/professor/entrar?cidade=${c.id}`}
                className="cartao flex min-h-24 items-center justify-center text-center font-display text-2xl font-extrabold hover:border-roxo"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <form action={entrarProfessor} className="cartao mx-auto grid max-w-md gap-4">
      <div>
        <p className="font-bold text-tinta-suave">{cidade.name}</p>
        <h1 className="text-3xl">Entrar como professor</h1>
      </div>
      <Aviso erro={sp.erro} />
      <input type="hidden" name="cidade" value={cidade.id} />
      <label className="grid gap-1 font-bold">
        Senha
        <input name="senha" type="password" required autoFocus autoComplete="current-password" className="campo" />
      </label>
      <Enviar>Entrar</Enviar>
      {todas.length > 1 && (
        <Link href="/professor/entrar" className="min-h-11 content-center font-bold text-roxo-escuro underline">
          ← Outra cidade
        </Link>
      )}
    </form>
  );
}
