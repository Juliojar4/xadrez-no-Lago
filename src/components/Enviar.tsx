"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/** Botão de enviar que trava enquanto o formulário está indo (evita registrar duas vezes). */
export function Enviar({ children, className = "btn" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? "Só um instante…" : children}
    </button>
  );
}
