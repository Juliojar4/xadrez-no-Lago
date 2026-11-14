import type { Metadata } from "next";
import Link from "next/link";
import { criarTurma } from "../acoes";
import { Aviso } from "@/components/Aviso";
import { Enviar } from "@/components/Enviar";
import { exigirProfessor } from "@/lib/sessao";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Minhas turmas" };

export default async function Professor({ searchParams }: PageProps<"/professor">) {
  const professor = await exigirProfessor();
  const supabase = await supabaseServer();
  const [sp, { data: turmas }] = await Promise.all([
    searchParams,
    supabase.from("classes").select("id, name, join_code, students(count)").is("archived_at", null).order("created_at"),
  ]);

  return (
    <div className="grid gap-5">
      <h1 className="text-3xl">Olá, {professor.nome}!</h1>
      <Aviso erro={sp.erro} />
      <section aria-labelledby="t-turmas" className="grid gap-3">
        <h2 id="t-turmas" className="text-2xl">
          Minhas turmas
        </h2>
        {!turmas?.length && <p className="cartao">Você ainda não tem turmas. Crie a primeira aqui embaixo.</p>}
        <ul className="grid gap-3 sm:grid-cols-2">
          {turmas?.map((t) => (
            <li key={t.id}>
              <Link href={`/professor/turmas/${t.id}`} className="cartao block hover:border-roxo">
                <span className="block font-display text-2xl font-extrabold">{t.name}</span>
                <span className="text-tinta-suave">
                  {t.students[0]?.count ?? 0} alunos · código <strong className="tracking-widest">{t.join_code}</strong>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <form action={criarTurma} className="cartao grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid gap-1 font-bold">
          Nova turma
          <input name="nome" required maxLength={60} placeholder="Ex.: Xadrez 5º ano — terça" className="campo" />
        </label>
        <Enviar>Criar turma</Enviar>
      </form>
    </div>
  );
}
