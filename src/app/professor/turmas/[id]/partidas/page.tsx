import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { anular, registrarPartidaProfessor, responderPartida } from "../../../../acoes";
import { Aviso } from "@/components/Aviso";
import { Enviar } from "@/components/Enviar";
import { LinhaPartida } from "@/components/LinhaPartida";
import { alunosDaTurma, partidas } from "@/lib/consultas";
import { ratingNaTela } from "@/lib/ranking";
import { exigirProfessor } from "@/lib/sessao";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Partidas" };

export default async function PartidasTurma({ params, searchParams }: PageProps<"/professor/turmas/[id]/partidas">) {
  await exigirProfessor();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await supabaseServer();
  const { data: turma } = await supabase.from("classes").select("id, name").eq("id", id).maybeSingle();
  if (!turma) notFound();
  const [alunos, pendentes, confirmadas] = await Promise.all([
    alunosDaTurma(id),
    partidas({ classId: id, status: "pendente" }),
    partidas({ classId: id, status: "confirmada", limite: 50 }),
  ]);

  const seletor = (name: string, rotulo: string) => (
    <label className="grid gap-1 font-bold">
      {rotulo}
      <select name={name} required defaultValue="" className="campo">
        <option value="" disabled>
          Escolha…
        </option>
        {alunos.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nickname} ({ratingNaTela(a)})
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="grid gap-5">
      <Link href={`/professor/turmas/${id}`} className="min-h-11 content-center font-bold text-roxo-escuro underline">
        ← {turma.name}
      </Link>
      <h1 className="text-3xl">Partidas</h1>
      <Aviso ok={sp.ok} erro={sp.erro} />

      <form action={registrarPartidaProfessor} className="cartao grid gap-4">
        <h2 className="text-2xl">Registrar resultado</h2>
        <input type="hidden" name="turma" value={id} />
        <div className="grid gap-3 sm:grid-cols-2">
          {seletor("brancas", "♔ Brancas")}
          {seletor("pretas", "♚ Pretas")}
        </div>
        <fieldset>
          <legend className="mb-1 font-bold">Resultado</legend>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["1", "Brancas venceram"],
              ["0.5", "Empate"],
              ["0", "Pretas venceram"],
            ].map(([valor, rotulo]) => (
              <label key={valor} className="opcao">
                <input type="radio" name="resultado" value={valor} required className="sr-only" />
                {rotulo}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Enviar>Registrar e atualizar rating</Enviar>
        </div>
      </form>

      {pendentes.length > 0 && (
        <section className="cartao border-sol" aria-labelledby="t-pend">
          <h2 id="t-pend" className="text-2xl">
            Esperando confirmação
          </h2>
          <p className="mb-2 text-base text-tinta-suave">
            Registradas por um aluno. O adversário confirma, ou você decide aqui.
          </p>
          <ul>
            {pendentes.map((p) => (
              <LinhaPartida key={p.id} p={p}>
                <form action={responderPartida} className="flex gap-2">
                  <input type="hidden" name="partida" value={p.id} />
                  <button name="resposta" value="sim" className="btn btn-p">
                    Confirmar
                  </button>
                  <button name="resposta" value="nao" className="btn btn-claro btn-p">
                    Recusar
                  </button>
                </form>
              </LinhaPartida>
            ))}
          </ul>
        </section>
      )}

      <section className="cartao" aria-labelledby="t-hist">
        <h2 id="t-hist" className="mb-2 text-2xl">
          Últimas partidas
        </h2>
        {confirmadas.length === 0 && <p className="text-tinta-suave">Nenhuma partida ainda.</p>}
        <ul>
          {confirmadas.map((p) => (
            <LinhaPartida key={p.id} p={p}>
              <details className="text-base">
                <summary className="min-h-11 cursor-pointer content-center text-tinta-suave underline">Anular</summary>
                <form action={anular} className="grid gap-1">
                  <input type="hidden" name="partida" value={p.id} />
                  <span>Registrada errado? O rating da turma será recalculado.</span>
                  <Enviar className="btn btn-claro btn-p">Sim, anular</Enviar>
                </form>
              </details>
            </LinhaPartida>
          ))}
        </ul>
      </section>
    </div>
  );
}
