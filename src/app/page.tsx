import Link from "next/link";
import { Surgir } from "@/components/Movimento";

const ENTRADAS = [
  { href: "/entrar", peca: "♞", titulo: "Sou aluno", texto: "Escolha a sua cidade e digite o seu PIN.", cor: "bg-roxo text-white" },
  { href: "/professor", peca: "♚", titulo: "Sou professor", texto: "Cadastre os alunos e registre as partidas.", cor: "bg-sol text-tinta" },
];

export default function Home() {
  return (
    <div className="grid gap-6 py-4">
      <div>
        <h1 className="text-4xl font-extrabold sm:text-5xl">Jogue xadrez com a sua turma!</h1>
        <p className="mt-2 text-xl text-tinta-suave">
          Cada partida muda o seu rating. Jogue, aprenda e suba no ranking.
        </p>
      </div>
      <nav aria-label="Entrar" className="grid gap-4 sm:grid-cols-2">
        {ENTRADAS.map((e, i) => (
          <Surgir key={e.href} ordem={i * 2}>
            <Link href={e.href} className="cartao flex h-full flex-col gap-2 hover:border-roxo">
              <span aria-hidden className={`grid size-16 place-items-center rounded-2xl text-4xl ${e.cor}`}>
                {e.peca}
              </span>
              <span className="font-display text-2xl font-extrabold">{e.titulo}</span>
              <span className="text-tinta-suave">{e.texto}</span>
            </Link>
          </Surgir>
        ))}
      </nav>
      <Link href="/admin" className="min-h-11 content-center justify-self-start text-base text-tinta-suave underline">
        Administração
      </Link>
    </div>
  );
}
