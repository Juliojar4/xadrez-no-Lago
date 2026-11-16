import "server-only";
import { mkdirSync } from "node:fs";
import { createClient, type InArgs, type Transaction } from "@libsql/client";

// Cidades → locais (cada local é uma turma, com ranking próprio) → alunos.
// Cada cidade tem um professor (a senha fica em `secrets`, na chave da cidade); o
// administrador (chave 'admin' em `secrets`) cria as cidades.
// Datas são texto ISO em UTC (o mesmo formato do toISOString), então ordenam como texto.
// ponytail: sem sistema de migrações; o esquema é criado se não existir. Para mudar uma
// tabela que já tem dados, escreva o `alter table` aqui (ou adote migrações numeradas).
const ESQUEMA = `
create table if not exists cities (
  id text primary key,
  name text not null check (length(name) between 2 and 60),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- ponytail: o lower() do SQLite só conhece ASCII ("Ágata" e "ágata" passam como diferentes).
create unique index if not exists cities_nome_unico on cities (lower(name));

create table if not exists classes (
  id text primary key,
  city_id text not null references cities on delete cascade,
  name text not null check (length(name) between 2 and 60),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create unique index if not exists classes_nome_unico on classes (city_id, lower(name));

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
create unique index if not exists students_apelido_unico on students (class_id, lower(nickname));

-- Senhas (admin e professor de cada cidade): hash scrypt com sal, class_id nulo.
-- PIN de aluno: class_id preenchido e hash SEM sal próprio (o sal é o local), porque o
-- aluno entra só com o PIN e é por (local, hash) que o achamos. O índice único garante
-- que dois alunos do mesmo local nunca têm o mesmo PIN.
create table if not exists secrets (
  user_id text primary key,
  class_id text,
  hash text not null
);
create unique index if not exists secrets_pin_unico on secrets (class_id, hash) where class_id is not null;

-- Tentativas erradas seguidas, por chave ("u:<quem>" ou "pin:<local>:<ip>").
create table if not exists attempts (
  key text primary key,
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

// Em produção: Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN). Sem essas variáveis,
// um arquivo SQLite local, que é o que o `pnpm dev` e os testes usam.
function abrir() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:data/xadrez.db";
  if (url === "file:data/xadrez.db") mkdirSync("data", { recursive: true });
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
}

// Uma conexão por processo (o globalThis sobrevive ao recarregamento do `next dev`).
const g = globalThis as { __xadrezDb?: ReturnType<typeof abrir> };
const cliente = (g.__xadrezDb ??= abrir());

// O esquema é conferido na primeira consulta, não ao importar o arquivo: no Turso isso é
// um fetch, e um fetch que nasce durante um prerender do Next é rejeitado quando o prerender
// termina. Se falhar, a promessa é descartada e a próxima consulta tenta de novo (antes, uma
// falha ficava guardada e derrubava todas as páginas até o servidor reiniciar).
// ponytail: uma ida extra ao banco a cada cold start.
let esquema: Promise<void> | undefined;
const garantirEsquema = () =>
  (esquema ??= cliente.executeMultiple(`pragma foreign_keys = on;${ESQUEMA}`).catch((e) => {
    esquema = undefined;
    throw e;
  }));
async function pronto() {
  try {
    await garantirEsquema();
  } catch {
    await garantirEsquema(); // a primeira tentativa pode ter sido a de um prerender abandonado
  }
}

type Linha = Record<string, unknown>;

/** Todas as linhas. */
export async function todos<T = Linha>(sql: string, args: InArgs = []): Promise<T[]> {
  await pronto();
  return (await cliente.execute({ sql, args })).rows as unknown as T[];
}
/** A primeira linha (ou undefined). */
export const um = async <T = Linha>(sql: string, args: InArgs = []) => (await todos<T>(sql, args))[0];
/** Insert/update/delete; `returning` vem pelo `todos`/`um`. */
export const rodar = async (sql: string, args: InArgs = []) => void (await todos(sql, args));

/**
 * Tudo ou nada. A transação de escrita pega a trava já no começo: quem lê aqui dentro
 * grava sem conflito. Use o `tx` recebido (e não `um`/`todos`) para ler e gravar.
 */
export async function transacao<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  await pronto();
  const tx = await cliente.transaction("write");
  try {
    const r = await fn(tx);
    await tx.commit();
    return r;
  } finally {
    tx.close(); // desfaz o que não foi confirmado
  }
}

/** Erro de índice único. */
export const ehDuplicado = (e: unknown) => /UNIQUE constraint failed/.test((e as Error)?.message ?? "");
