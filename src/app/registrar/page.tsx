import type { Metadata } from "next";
import Link from "next/link";
import { registrarPartidaAluno } from "../acoes";
import { Avatar } from "@/components/Avatar";
import { Aviso } from "@/components/Aviso";
import { Enviar } from "@/components/Enviar";
import { ValePontos } from "@/components/ValePontos";
import { alunosDaTurma } from "@/lib/consultas";
import { ratingNaTela } from "@/lib/ranking";
import { exigirAluno } from "@/lib/sessao";

export const metadata: Metadata = { title: "Registrar partida" };

function Opcao({ name, value, children }: { name: string; value: string; children: React.ReactNode }) {
  return (
    <label className="opcao">
      <input type="radio" name={name} value={value} required className="sr-only" />
      {children}
    </label>
  );
}

export default async function Registrar({ searchParams }: PageProps<"/registrar">) {
  const eu = await exigirAluno("/registrar");
  const [sp, alunos] = await Promise.all([searchParams, alunosDaTurma(eu.classId)]);
  const meu = alunos.find((a) => a.id === eu.id);
  const colegas = alunos.filter((a) => a.id !== eu.id);
  const adversario = colegas.find((a) => a.id === sp.adversario);

  if (!meu || !adversario)
    return (
      <div className="grid gap-4">
        <Aviso erro={sp.erro} />
        <h1 className="text-3xl">Contra quem você jogou?</h1>
        {colegas.length === 0 && <p className="cartao">Ainda não tem colegas na sua turma.</p>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {colegas.map((a) => (
            <li key={a.id}>
              <Link href={`/registrar?adversario=${a.id}`} className="cartao flex h-full flex-col items-center gap-1 text-center font-bold hover:border-roxo">
                <Avatar chave={a.avatar} tamanho={64} />
                {a.nickname}
                <span className="font-display text-tinta-suave">{ratingNaTela(a)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <form action={registrarPartidaAluno} className="grid gap-5">
      <Aviso erro={sp.erro} />
      <input type="hidden" name="adversario" value={adversario.id} />
      <div className="cartao flex items-center justify-center gap-4 text-center font-bold">
        <span className="grid justify-items-center gap-1">
          <Avatar chave={meu.avatar} tamanho={64} />
          Você
          <span className="font-display text-tinta-suave">{ratingNaTela(meu)}</span>
        </span>
        <span aria-hidden className="font-display text-3xl font-extrabold text-roxo">
          ×
        </span>
        <span className="grid justify-items-center gap-1">
          <Avatar chave={adversario.avatar} tamanho={64} />
          {adversario.nickname}
          <span className="font-display text-tinta-suave">{ratingNaTela(adversario)}</span>
        </span>
      </div>

      <section className="cartao">
        <ValePontos a={{ ...meu, nickname: "Você" }} b={adversario} rotulo="O que vale essa partida" />
      </section>

      <fieldset className="cartao">
        <legend className="float-left mb-2 w-full font-display text-xl font-extrabold">Você jogou de…</legend>
        <div className="clear-both grid grid-cols-2 gap-3">
          <Opcao name="cor" value="brancas">
            <span aria-hidden className="text-3xl">♔</span> Brancas
          </Opcao>
          <Opcao name="cor" value="pretas">
            <span aria-hidden className="text-3xl">♚</span> Pretas
          </Opcao>
        </div>
      </fieldset>

      <fieldset className="cartao">
        <legend className="float-left mb-2 w-full font-display text-xl font-extrabold">Como terminou?</legend>
        <div className="clear-both grid grid-cols-3 gap-3">
          <Opcao name="resultado" value="ganhei">Ganhei</Opcao>
          <Opcao name="resultado" value="empatei">Empatamos</Opcao>
          <Opcao name="resultado" value="perdi">Perdi</Opcao>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Enviar>Enviar para {adversario.nickname} confirmar</Enviar>
        <Link href="/registrar" className="btn btn-claro">
          Trocar adversário
        </Link>
      </div>
    </form>
  );
}
