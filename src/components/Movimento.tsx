"use client";

import { MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";

/** Liga o respeito ao `prefers-reduced-motion` para todas as animações do Motion. */
export function Movimento({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Entrada curtinha (sobe e aparece). `ordem` escalona itens de uma lista. */
export function Surgir({ children, ordem = 0, className }: { children: ReactNode; ordem?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(ordem, 10) * 0.04 }}
    >
      {children}
    </motion.div>
  );
}
