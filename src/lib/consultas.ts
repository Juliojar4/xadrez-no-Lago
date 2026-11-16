import "server-only";
import { todos, um } from "./db";
import type { AlunoLista } from "./ranking";
import type { Aluno, Jogo } from "./tipos";

// Não existe mais RLS: quem chama estas funções já passou por exigirAluno/exigirProfessor/getViewer.

/** A turma única do site (não existe antes de o professor criar a senha). */
export const turmaUnica = () => um<{ id: string; name: string; join_code: string }>("select id, name, join_code from classes");

/** Todos os alunos da turma, inclusive os desativados (tela do professor). */
export const todosOsAlunos = (classId: string) => todos<Aluno>("select * from students where class_id = ?", [classId]);

export const alunoPorId = (id: string) => um<Aluno>("select * from students where id = ?", [id]);

/** Alunos ativos de uma turma. */
export const alunosDaTurma = (classId: string) =>
  todos<AlunoLista>(
    `select id, nickname, avatar, rating, rd, last_played_at, games_played
     from students where class_id = ? and active = 1 order by nickname collate nocase`,
    [classId],
  );

type Quem = { nickname: string; avatar: string };
export type Partida = Jogo & { white: Quem; black: Quem };

export async function partidas(filtro: { classId?: string; alunoId?: string; status: "pendente" | "confirmada"; limite?: number }) {
  const linhas = await todos<Jogo & { wn: string; wa: string; bn: string; ba: string }>(
    `select g.*, w.nickname wn, w.avatar wa, b.nickname bn, b.avatar ba
     from games g join students w on w.id = g.white_id join students b on b.id = g.black_id
     where g.status = :status
       and (:classId is null or g.class_id = :classId)
       and (:alunoId is null or :alunoId in (g.white_id, g.black_id))
     order by ${filtro.status === "confirmada" ? "g.played_at" : "g.created_at"} desc
     limit :limite`,
    {
      status: filtro.status,
      classId: filtro.classId ?? null,
      alunoId: filtro.alunoId ?? null,
      limite: filtro.limite ?? 500,
    },
  );
  return linhas.map(({ wn, wa, bn, ba, ...g }): Partida => ({
    ...g,
    white: { nickname: wn, avatar: wa },
    black: { nickname: bn, avatar: ba },
  }));
}

const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
export const dataCurta = (iso: string | null) => (iso ? dia.format(new Date(iso)) : "");
