import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ratingNaTela } from "@/lib/ranking";
import { exigirResponsavel } from "@/lib/sessao";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meus filhos" };

export default async function Responsavel() {
  await exigirResponsavel();
  const supabase = await supabaseServer();
  // RLS: o responsável só enxerga os alunos vinculados a ele.
  const { data: filhos } = await supabase
    .from("students")
    .select("id, nickname, avatar, rating, rd, last_played_at, games_played")
    .order("nickname");

  return (
    <div className="grid gap-4">
      <h1 className="text-3xl">Acompanhe o xadrez</h1>
      <p className="text-tinta-suave">Você só visualiza: aqui não há mensagens nem publicações.</p>
      {!filhos?.length && <p className="cartao">Nenhum aluno vinculado a este e-mail ainda. Fale com o professor.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {filhos?.map((a) => (
          <li key={a.id}>
            <Link href={`/aluno/${a.id}`} className="cartao flex items-center gap-3 hover:border-roxo">
              <Avatar chave={a.avatar} tamanho={56} />
              <span className="flex-1 font-bold">{a.nickname}</span>
              <span className="font-display text-2xl font-extrabold">{ratingNaTela(a)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
