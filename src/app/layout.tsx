import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { sair } from "./acoes";
import { Avatar } from "@/components/Avatar";
import { Movimento } from "@/components/Movimento";
import { getViewer, inicioDe } from "@/lib/sessao";
import "./globals.css";

const titulo = Baloo_2({ variable: "--font-titulo", subsets: ["latin"], weight: ["700", "800"] });
const corpo = Nunito({ variable: "--font-corpo", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Xadrez da Turma", template: "%s · Xadrez da Turma" },
  description: "Jogue xadrez com a sua turma e acompanhe o seu rating.",
};
export const viewport: Viewport = { themeColor: "#5b2be0" };

async function Conta() {
  const v = await getViewer();
  if (!v) return null;
  return (
    <div className="flex items-center gap-2">
      <Link href={inicioDe(v)} className="flex min-h-11 items-center gap-2 rounded-xl px-2 font-bold">
        {v.tipo === "aluno" && <Avatar chave={v.avatar} tamanho={36} />}
        <span className="max-sm:sr-only">
          {v.tipo === "aluno" ? v.apelido : v.nome}
        </span>
      </Link>
      <form action={sair}>
        <button className="btn btn-claro btn-p">Sair</button>
      </form>
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${corpo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans text-lg">
        <a href="#conteudo" className="btn sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10">
          Pular para o conteúdo
        </a>
        <header className="border-b-2 border-linha bg-papel">
          <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-3 px-4">
            <Link href="/" className="flex min-h-11 items-center gap-2 font-display text-2xl font-extrabold text-roxo-escuro">
              <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-roxo text-2xl text-sol">
                ♞
              </span>
              Xadrez da Turma
            </Link>
            <Suspense>
              <Conta />
            </Suspense>
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <Movimento>
            <Suspense fallback={<p className="py-10 text-center text-tinta-suave">Arrumando as peças…</p>}>
              {children}
            </Suspense>
          </Movimento>
        </main>
      </body>
    </html>
  );
}
