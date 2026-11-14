import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { alternarAtivo } from "../acoes";
import { Avatar } from "@/components/Avatar";
import { NovoAluno, NovoPin } from "@/components/FormulariosProfessor";
import { NIVEIS, type Nivel } from "@/lib/dominio";
import { ratingNaTela } from "@/lib/ranking";
import { exigirProfessor } from "@/lib/sessao";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Minha turma" };

export default async function Professor() {
  await exigirProfessor();
  const supabase = await supabaseServer();
  const { data: turma, error } = await supabase.from("classes").select("id, join_code, students(*)").single();
  if (error) throw error;

  const alunos = turma.students.sort((a, b) => Number(b.active) - Number(a.active) || b.rating - a.rating);
  // O QR da mesa leva o aluno direto para "registrar partida" (passando pelo login).
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/entrar?codigo=${turma.join_code}&next=/registrar`;
  const qr = await QRCode.toString(link, { type: "svg", margin: 1 });

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Minha turma</h1>
        <Link href="/professor/partidas" className="btn btn-sol">
          Registrar partidas
        </Link>
      </div>

      <section className="cartao flex flex-wrap items-center gap-5" aria-labelledby="t-codigo">
        {/* SVG gerado no servidor pela lib qrcode a partir de um link nosso */}
        <div className="w-36 shrink-0" role="img" aria-label="QR code para registrar partida" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="min-w-0 flex-1">
          <h2 id="t-codigo" className="text-xl">
            Código da turma
          </h2>
          <p className="font-display text-5xl font-extrabold tracking-widest text-roxo">{turma.join_code}</p>
          <p className="text-base text-tinta-suave">
            Os alunos entram com este código, o apelido e o PIN. Imprima o QR e deixe nas mesas: ele abre direto o
            registro de partida.
          </p>
        </div>
      </section>

      <section className="cartao" aria-labelledby="t-alunos">
        <h2 id="t-alunos" className="mb-2 text-2xl">
          Alunos ({alunos.filter((a) => a.active).length})
        </h2>
        {alunos.length === 0 && <p className="text-tinta-suave">Cadastre o primeiro aluno aqui embaixo.</p>}
        <ul>
          {alunos.map((a) => (
            <li key={a.id} className={`border-b-2 border-linha py-2 last:border-0 ${a.active ? "" : "opacity-60"}`}>
              <details>
                <summary className="flex min-h-12 cursor-pointer items-center gap-3">
                  <Avatar chave={a.avatar} tamanho={40} />
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {a.nickname}
                    {!a.active && " (desativado)"}
                  </span>
                  <span className="text-base text-tinta-suave max-sm:hidden">
                    {NIVEIS[a.initial_level as Nivel].rotulo} · {a.games_played} partidas
                  </span>
                  <span className="font-display text-xl font-extrabold tabular-nums">{ratingNaTela(a)}</span>
                </summary>
                <div className="grid gap-3 rounded-2xl bg-fundo p-3">
                  <NovoPin alunoId={a.id} />
                  <div className="flex flex-wrap gap-3">
                    <Link href={`/aluno/${a.id}`} className="btn btn-claro btn-p">
                      Ver página
                    </Link>
                    <form action={alternarAtivo}>
                      <input type="hidden" name="aluno" value={a.id} />
                      <input type="hidden" name="ativo" value={a.active ? "nao" : "sim"} />
                      <button className="btn btn-claro btn-p">{a.active ? "Desativar aluno" : "Reativar aluno"}</button>
                    </form>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="cartao" aria-labelledby="t-novo">
        <h2 id="t-novo" className="mb-3 text-2xl">
          Cadastrar aluno
        </h2>
        <NovoAluno />
      </section>
    </div>
  );
}
