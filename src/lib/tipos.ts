import type { Nivel } from "./dominio";

/** Linhas das tabelas (o esquema está em db.ts). Booleanos do SQLite são 0/1. */
export type Aluno = {
  id: string;
  class_id: string;
  nickname: string;
  avatar: string;
  initial_level: Nivel;
  rating: number;
  rd: number;
  last_played_at: string | null;
  games_played: number;
  active: number;
  created_at: string;
};

export type Jogo = {
  id: string;
  class_id: string;
  white_id: string;
  black_id: string;
  white_score: number;
  status: "pendente" | "confirmada" | "recusada" | "anulada";
  reported_by: string;
  confirmed_by: string | null;
  played_at: string | null;
  white_rating_before: number | null;
  white_rd_before: number | null;
  white_rating_after: number | null;
  white_rd_after: number | null;
  black_rating_before: number | null;
  black_rd_before: number | null;
  black_rating_after: number | null;
  black_rd_after: number | null;
  created_at: string;
};
