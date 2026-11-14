"use client";

import { useActionState } from "react";
import { criarAluno, redefinirPin, type EstadoPin } from "@/app/acoes";
import { Avatar } from "./Avatar";
import { Enviar } from "./Enviar";
import { AVATARES, NIVEIS } from "@/lib/dominio";

/** O PIN só aparece uma vez (no banco fica apenas o hash). */
function PinNovo({ estado }: { estado: EstadoPin }) {
  if (estado.erro)
    return (
      <p role="alert" className="rounded-2xl border-2 border-coral bg-coral-claro px-4 py-3 font-bold text-[#8a1640]">
        {estado.erro}
      </p>
    );
  if (!estado.pin) return null;
  return (
    <p role="status" className="rounded-2xl border-2 border-menta bg-menta-clara px-4 py-3 text-[#0b4f49]">
      PIN de <strong>{estado.apelido}</strong>:{" "}
      <strong className="font-display text-3xl tracking-widest">{estado.pin}</strong>
      <span className="block text-base">Anote agora: ele não aparece de novo. Dá para gerar outro quando quiser.</span>
    </p>
  );
}

export function NovoAluno() {
  const [estado, acao] = useActionState(criarAluno, {});
  return (
    // a key limpa o formulário depois de cada aluno criado
    <form action={acao} key={estado.pin} className="grid gap-4">
      <PinNovo estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 font-bold">
          Apelido (sem sobrenome)
          <input name="apelido" required minLength={2} maxLength={20} autoComplete="off" className="campo" />
        </label>
        <label className="grid gap-1 font-bold">
          Nível inicial
          <select name="nivel" required defaultValue="iniciante" className="campo">
            {Object.entries(NIVEIS).map(([k, n]) => (
              <option key={k} value={k}>
                {n.rotulo} ({n.rating})
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="mb-1 font-bold">Avatar</legend>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
          {AVATARES.map((a, i) => (
            <label key={a} className="opcao min-h-0 p-1">
              <input type="radio" name="avatar" value={a} required defaultChecked={i === 0} className="sr-only" />
              <Avatar chave={a} tamanho={40} />
              <span className="sr-only">{a.replace("-", " ")}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <Enviar>Cadastrar aluno</Enviar>
      </div>
    </form>
  );
}

export function NovoPin({ alunoId }: { alunoId: string }) {
  const [estado, acao] = useActionState(redefinirPin, {});
  return (
    <form action={acao} className="grid gap-2">
      <input type="hidden" name="aluno" value={alunoId} />
      <PinNovo estado={estado} />
      <div>
        <Enviar className="btn btn-claro btn-p">Gerar PIN novo</Enviar>
      </div>
    </form>
  );
}
