"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "./Avatar";

export type OpcaoSeletor = { valor: string; rotulo: string; detalhe?: string; avatar?: string };

/** Sem acento e em minúsculas: "kaua" acha "Kauã". */
const limpo = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Lista de escolha com busca (padrão "combobox" da ARIA): digite para filtrar,
 * setas para andar, Enter para escolher, Esc para fechar. O valor escolhido vai
 * no formulário por um <input hidden> com o `name`.
 */
export function Seletor({
  name,
  rotulo,
  opcoes,
  valorInicial = "",
  required,
  dica = "Digite para filtrar…",
}: {
  name: string;
  rotulo: string;
  opcoes: OpcaoSeletor[];
  valorInicial?: string;
  required?: boolean;
  dica?: string;
}) {
  const id = useId();
  const [valor, setValor] = useState(valorInicial);
  const [busca, setBusca] = useState<string | null>(null); // null = não está buscando
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const lista = useRef<HTMLUListElement>(null);

  const escolhida = opcoes.find((o) => o.valor === valor);
  const filtradas = busca ? opcoes.filter((o) => limpo(o.rotulo).includes(limpo(busca))) : opcoes;
  const indice = Math.min(ativo, Math.max(filtradas.length - 1, 0));

  useEffect(() => {
    if (aberto) lista.current?.children[indice]?.scrollIntoView({ block: "nearest" });
  }, [aberto, indice]);

  const abrir = () => {
    setAtivo(Math.max(filtradas.findIndex((o) => o.valor === valor), 0));
    setAberto(true);
  };
  const fechar = () => {
    setAberto(false);
    setBusca(null);
  };
  const escolher = (o: OpcaoSeletor) => {
    setValor(o.valor);
    fechar();
  };

  return (
    <div
      className="relative grid gap-1"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) fechar();
      }}
    >
      <label htmlFor={id} className="font-bold">
        {rotulo}
      </label>
      <input type="hidden" name={name} value={valor} />
      <div className="relative">
        {escolhida?.avatar && busca === null && (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
            <Avatar chave={escolhida.avatar} tamanho={32} />
          </span>
        )}
        <input
          id={id}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={aberto && filtradas[indice] ? `${id}-${indice}` : undefined}
          autoComplete="off"
          required={required}
          placeholder={aberto ? dica : "Escolha…"}
          // buscando: mostra o que foi digitado; senão, o nome da opção escolhida
          value={busca ?? escolhida?.rotulo ?? ""}
          onChange={(e) => {
            setBusca(e.target.value);
            setValor(""); // digitou de novo: precisa escolher outra vez
            setAtivo(0);
            setAberto(true);
          }}
          onClick={() => (aberto ? undefined : abrir())}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!aberto) return abrir();
              const passo = e.key === "ArrowDown" ? 1 : -1;
              setAtivo((indice + passo + filtradas.length) % Math.max(filtradas.length, 1));
            } else if (e.key === "Enter" && aberto) {
              e.preventDefault(); // não envia o formulário enquanto a lista está aberta
              if (filtradas[indice]) escolher(filtradas[indice]);
            } else if (e.key === "Escape" && aberto) {
              e.preventDefault();
              fechar();
            }
          }}
          className={`campo pr-11 ${escolhida?.avatar && busca === null ? "pl-12" : ""} ${escolhida ? "font-bold" : ""}`}
        />
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-roxo transition-transform ${aberto ? "rotate-180" : ""}`}
        >
          <path d="M4 7l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {aberto && (
        <ul
          ref={lista}
          id={`${id}-lista`}
          role="listbox"
          aria-label={rotulo}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-2xl border-2 border-roxo bg-papel p-1 shadow-[0_8px_0_var(--color-linha)]"
        >
          {filtradas.length === 0 && (
            <li className="px-3 py-3 text-tinta-suave">Ninguém com esse nome. Tente outra letra.</li>
          )}
          {filtradas.map((o, i) => (
            <li
              key={o.valor}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.valor === valor}
              // mousedown sem perder o foco do campo; a escolha acontece no click (funciona no toque)
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(o)}
              onMouseEnter={() => setAtivo(i)}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 ${
                i === indice ? "bg-[#ece4ff]" : ""
              }`}
            >
              {o.avatar && <Avatar chave={o.avatar} tamanho={32} />}
              <span className="min-w-0 flex-1 truncate font-bold">{o.rotulo}</span>
              {o.detalhe && <span className="font-display tabular-nums text-tinta-suave">{o.detalhe}</span>}
              {o.valor === valor && (
                <span aria-hidden className="font-bold text-roxo">
                  ✓
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
