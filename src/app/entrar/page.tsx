import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { entrarAluno } from "../acoes";
import { Avatar } from "@/components/Avatar";
import { Aviso } from "@/components/Aviso";
import { Enviar } from "@/components/Enviar";
import { alunosDaTurma } from "@/lib/consultas";
import { destinoSeguro } from "@/lib/dominio";
import { getViewer } from "@/lib/sessao";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Entrar" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = destinoSeguro(um(sp.next));
  if ((await getViewer())?.tipo === "aluno") redirect(next);

  const codigo = um(sp.codigo).trim().toUpperCase().slice(0, 12);
  const alunoId = um(sp.aluno);
  const comNext = (qs: string) => `/entrar?${qs}&next=${encodeURIComponent(next)}`;

  // Passo 1: código da turma
  if (!codigo)
    return (
      <form className="cartao mx-auto grid max-w-md gap-4">
        <h1 className="text-3xl">Qual é o código da sua turma?</h1>
        <label className="grid gap-1 font-bold">
          Código (está no quadro ou no QR da mesa)
          <input name="codigo" required autoFocus autoCapitalize="characters" autoComplete="off" maxLength={12} className="campo text-center font-display text-3xl uppercase tracking-widest" />
        </label>
        <input type="hidden" name="next" value={next} />
        <button className="btn">Continuar</button>
      </form>
    );

  // Quem ainda não entrou só recebe a lista de apelidos se tiver o código da turma.
  // Só apelido e avatar.
  const turma = db.prepare("select id, name from classes where join_code = ? and archived_at is null").get(codigo) as
    | { id: string; name: string }
    | undefined;
  const alunos = turma ? await alunosDaTurma(turma.id) : [];

  if (!turma)
    return (
      <div className="cartao mx-auto grid max-w-md gap-4">
        <h1 className="text-3xl">Não achei essa turma</h1>
        <p>Confira o código com o professor e tente de novo.</p>
        <Link href={comNext("")} className="btn">
          Tentar outro código
        </Link>
      </div>
    );

  // Passo 3: PIN
  const aluno = alunos.find((a) => a.id === alunoId);
  if (aluno)
    return (
      <form action={entrarAluno} className="cartao mx-auto grid max-w-md gap-4 text-center">
        <div className="grid justify-items-center gap-2">
          <Avatar chave={aluno.avatar} tamanho={88} />
          <h1 className="text-3xl">Oi, {aluno.nickname}!</h1>
        </div>
        <Aviso erro={sp.erro} />
        <label className="grid gap-1 font-bold">
          Digite o seu PIN de 4 números
          <input name="pin" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} required autoFocus autoComplete="off" className="campo text-center font-display text-4xl tracking-[0.5em]" />
        </label>
        <input type="hidden" name="codigo" value={codigo} />
        <input type="hidden" name="aluno" value={aluno.id} />
        <input type="hidden" name="next" value={next} />
        <Enviar>Entrar</Enviar>
        <Link href={comNext(`codigo=${codigo}`)} className="min-h-11 content-center font-bold text-roxo-escuro underline">
          Não sou eu
        </Link>
      </form>
    );

  // Passo 2: quem é você?
  return (
    <div className="grid gap-4">
      <div>
        <p className="font-bold text-tinta-suave">{turma.name}</p>
        <h1 className="text-3xl">Quem é você?</h1>
      </div>
      {alunos.length === 0 && <p className="cartao">Essa turma ainda não tem alunos. Chame o professor!</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {alunos.map((a) => (
          <li key={a.id}>
            <Link href={comNext(`codigo=${codigo}&aluno=${a.id}`)} className="cartao flex h-full flex-col items-center gap-2 text-center font-bold hover:border-roxo">
              <Avatar chave={a.avatar} tamanho={64} />
              {a.nickname}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
