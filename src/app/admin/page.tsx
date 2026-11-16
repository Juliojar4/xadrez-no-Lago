import type { Metadata } from "next";
import { criarCidade, trocarSenhaCidade } from "../acoes";
import { Aviso } from "@/components/Aviso";
import { Enviar } from "@/components/Enviar";
import { cidades } from "@/lib/consultas";
import { exigirAdmin } from "@/lib/sessao";

export const metadata: Metadata = { title: "Administração" };

export default async function Admin({ searchParams }: PageProps<"/admin">) {
  await exigirAdmin();
  const [sp, todas] = await Promise.all([searchParams, cidades()]);

  return (
    <div className="grid gap-5">
      <h1 className="text-3xl">Cidades</h1>
      <Aviso ok={sp.ok} erro={sp.erro} />

      <section className="cartao" aria-labelledby="t-cidades">
        <h2 id="t-cidades" className="mb-2 text-2xl">
          Cadastradas ({todas.length})
        </h2>
        {todas.length === 0 && <p className="text-tinta-suave">Crie a primeira cidade aqui embaixo.</p>}
        <ul>
          {todas.map((c) => (
            <li key={c.id} className="border-b-2 border-linha py-2 last:border-0">
              <details>
                <summary className="flex min-h-12 cursor-pointer items-center gap-3">
                  <span className="min-w-0 flex-1 truncate font-bold">{c.name}</span>
                  <span className="text-base text-tinta-suave">
                    {c.locais} {c.locais === 1 ? "local" : "locais"}
                  </span>
                </summary>
                <form action={trocarSenhaCidade} className="grid gap-2 rounded-2xl bg-fundo p-3">
                  <input type="hidden" name="cidade" value={c.id} />
                  <label className="grid gap-1 font-bold">
                    Nova senha do professor (8 letras ou mais)
                    <input name="senha" type="password" required minLength={8} autoComplete="new-password" className="campo" />
                  </label>
                  <div>
                    <Enviar className="btn btn-claro btn-p">Trocar senha</Enviar>
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <form action={criarCidade} className="cartao grid gap-4">
        <h2 className="text-2xl">Nova cidade</h2>
        <p className="text-base text-tinta-suave">
          Passe a senha para o professor da cidade: é com ela que ele entra, cria os locais e cadastra os alunos.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 font-bold">
            Nome da cidade
            <input name="nome" required minLength={2} maxLength={60} autoComplete="off" className="campo" />
          </label>
          <label className="grid gap-1 font-bold">
            Senha do professor (8 letras ou mais)
            <input name="senha" type="password" required minLength={8} autoComplete="new-password" className="campo" />
          </label>
        </div>
        <div>
          <Enviar>Criar cidade</Enviar>
        </div>
      </form>
    </div>
  );
}
