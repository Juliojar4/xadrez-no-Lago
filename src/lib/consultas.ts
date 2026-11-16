import "server-only";
import { todos, um } from "./db";
import type { AlunoLista } from "./ranking";
import type { Jogador } from "./rating";
import type { Aluno, Jogo } from "./tipos";

// Não existe RLS: quem chama estas funções já passou por exigirAluno/exigirProfessor/getViewer.
// As que recebem `cityId` só devolvem o que é daquela cidade (o professor é a cidade).

export type Cidade = { id: string; name: string; locais: number };
export const cidades = () =>
  todos<Cidade>(
    `select c.id, c.name, (select count(*) from classes l where l.city_id = c.id) locais
     from cities c order by c.name collate nocase`,
  );

export type Local = { id: string; name: string };
export const locaisDaCidade = (cityId: string) =>
  todos<Local>("select id, name from classes where city_id = ? order by name collate nocase", [cityId]);

/** Os locais da cidade e o escolhido em `?local=` (ou o primeiro). */
export async function localDaVez(cityId: string, pedido: string | string[] | undefined) {
  const locais = await locaisDaCidade(cityId);
  return { locais, atual: locais.find((l) => l.id === pedido) ?? locais.at(0) };
}

/** O aluno, se for de um local daquela cidade. */
export const alunoDaCidade = (id: string, cityId: string) =>
  um<Aluno>("select s.* from students s join classes l on l.id = s.class_id where s.id = ? and l.city_id = ?", [id, cityId]);

/** A partida, se for de um local daquela cidade. */
export const partidaDaCidade = (id: string, cityId: string) =>
  um<Jogo>("select g.* from games g join classes l on l.id = g.class_id where g.id = ? and l.city_id = ?", [id, cityId]);

/** Todos os alunos do local, inclusive os desativados (tela do professor). */
export const todosOsAlunos = (classId: string) => todos<Aluno>("select * from students where class_id = ?", [classId]);

export const alunoPorId = (id: string) => um<Aluno>("select * from students where id = ?", [id]);

/** Alunos ativos de uma turma. */
export const alunosDaTurma = (classId: string) =>
  todos<AlunoLista>(
    `select id, nickname, avatar, rating, rd, last_played_at, games_played
     from students where class_id = ? and active = 1 order by nickname collate nocase`,
    [classId],
  );

type Quem = Jogador & { nickname: string; avatar: string };
export type Partida = Jogo & { white: Quem; black: Quem };

export async function partidas(filtro: { classId?: string; alunoId?: string; status: "pendente" | "confirmada"; limite?: number }) {
  // os dois lados vêm com o rating de agora (para a prévia "quanto vale" das pendentes)
  const lado = (x: string) =>
    `${x}.nickname ${x}_nickname, ${x}.avatar ${x}_avatar, ${x}.rating ${x}_rating, ${x}.rd ${x}_rd, ` +
    `${x}.last_played_at ${x}_last_played_at, ${x}.games_played ${x}_games_played`;
  const linhas = await todos<Jogo & Record<string, unknown>>(
    `select g.*, ${lado("w")}, ${lado("b")}
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
  const pegar = (l: Record<string, unknown>, x: string, id: string) =>
    ({
      id,
      nickname: l[`${x}_nickname`],
      avatar: l[`${x}_avatar`],
      rating: l[`${x}_rating`],
      rd: l[`${x}_rd`],
      last_played_at: l[`${x}_last_played_at`],
      games_played: l[`${x}_games_played`],
    }) as Quem;
  return linhas.map((l): Partida => ({ ...l, white: pegar(l, "w", l.white_id), black: pegar(l, "b", l.black_id) }));
}

const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
export const dataCurta = (iso: string | null) => (iso ? dia.format(new Date(iso)) : "");
