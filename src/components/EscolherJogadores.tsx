"use client";

import { useState } from "react";
import { ratingNaTela } from "@/lib/ranking";
import { Seletor } from "./Seletor";
import { ValePontos, type Lado } from "./ValePontos";

/** Brancas e pretas do formulário do professor; assim que os dois são escolhidos, mostra quanto vale. */
export function EscolherJogadores({ alunos }: { alunos: Lado[] }) {
  const [brancas, setBrancas] = useState("");
  const [pretas, setPretas] = useState("");
  const opcoes = alunos.map((a) => ({ valor: a.id, rotulo: a.nickname, detalhe: ratingNaTela(a), avatar: a.avatar }));
  const a = alunos.find((x) => x.id === brancas);
  const b = alunos.find((x) => x.id === pretas);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Seletor name="brancas" rotulo="♔ Brancas" opcoes={opcoes} required dica="Digite o apelido…" onChange={setBrancas} />
        <Seletor name="pretas" rotulo="♚ Pretas" opcoes={opcoes} required dica="Digite o apelido…" onChange={setPretas} />
      </div>
      {a && b && a.id !== b.id && (
        <div aria-live="polite" className="rounded-2xl bg-fundo p-3">
          <ValePontos a={a} b={b} />
        </div>
      )}
    </>
  );
}
