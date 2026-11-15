import "server-only";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

// O site tem UM professor e UMA turma (índices únicos abaixo garantem isso).
// Datas são texto ISO em UTC (o mesmo formato do toISOString), então ordenam como texto.
// ponytail: sem sistema de migrações; o esquema é criado se não existir. Para mudar uma
// tabela que já tem dados, escreva o `alter table` aqui (ou adote migrações numeradas).
const ESQUEMA = `
create table if not exists teachers (
  id text primary key,
  name text not null check (length(name) between 1 and 80),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create unique index if not exists um_professor_so on teachers ((1));

create table if not exists classes (
  id text primary key,
  teacher_id text not null references teachers on delete cascade,
  name text not null check (length(name) between 1 and 60),
  join_code text not null unique,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at text
);
create unique index if not exists uma_turma_so on classes ((1));

create table if not exists students (
  id text primary key,
  class_id text not null references classes on delete cascade,
  nickname text not null check (length(nickname) between 2 and 20),
  avatar text not null,
  initial_level text not null check (initial_level in ('iniciante', 'intermediario', 'avancado')),
  rating real not null,
  rd real not null,
  last_played_at text,
  games_played integer not null default 0,
  active integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- ponytail: o lower() do SQLite só conhece ASCII ("Ágata" e "ágata" passam como diferentes).
create unique index if not exists students_apelido_unico on students (class_id, lower(nickname));

-- Senha do professor e PIN dos alunos (hash scrypt). Nunca vai em "select *" de aluno.
create table if not exists secrets (
  user_id text primary key,
  hash text not null,
  failed_attempts integer not null default 0,
  locked_until text
);

create table if not exists sessions (
  token_hash text primary key,
  user_id text not null,
  expires_at text not null
);

create table if not exists games (
  id text primary key,
  class_id text not null references classes on delete cascade,
  white_id text not null references students on delete cascade,
  black_id text not null references students on delete cascade,
  white_score real not null check (white_score in (1, 0.5, 0)),
  mode text not null default 'presencial' check (mode in ('presencial', 'online')),
  rated integer not null default 1,
  status text not null default 'pendente' check (status in ('pendente', 'confirmada', 'recusada', 'anulada')),
  reported_by text not null,
  confirmed_by text,
  -- momento em que o rating foi aplicado (é o "playedAt" do Glicko e a ordem do replay)
  played_at text,
  white_rating_before real, white_rd_before real,
  white_rating_after real, white_rd_after real,
  black_rating_before real, black_rd_before real,
  black_rating_after real, black_rd_after real,
  pgn text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check (white_id <> black_id)
);
create index if not exists games_turma on games (class_id, played_at);
create index if not exists games_brancas on games (white_id);
create index if not exists games_pretas on games (black_id);
`;

function abrir() {
  const caminho = process.env.DATABASE_PATH ?? "data/xadrez.db";
  if (caminho !== ":memory:") mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec("pragma busy_timeout = 5000; pragma journal_mode = wal; pragma foreign_keys = on;");
  db.exec(ESQUEMA);
  return db;
}

// Uma conexão por processo (o globalThis sobrevive ao recarregamento do `next dev`).
const g = globalThis as { __xadrezDb?: DatabaseSync };
export const db = (g.__xadrezDb ??= abrir());

/** Tudo ou nada. `begin immediate` pega a trava de escrita já no começo: quem lê aqui dentro grava sem conflito. */
export function transacao<T>(fn: () => T): T {
  db.exec("begin immediate");
  try {
    const r = fn();
    db.exec("commit");
    return r;
  } catch (e) {
    db.exec("rollback");
    throw e;
  }
}

/** Erro de índice único (SQLITE_CONSTRAINT_UNIQUE). */
export const ehDuplicado = (e: unknown) => (e as { errcode?: number })?.errcode === 2067;
