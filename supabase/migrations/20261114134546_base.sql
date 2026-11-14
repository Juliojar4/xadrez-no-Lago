-- Fase 1: o professor, a turma, os alunos e as partidas.
-- O site tem UM professor e UMA turma (índices únicos abaixo garantem isso).
-- Regra geral: clientes só LEEM (RLS). Toda escrita de aluno/partida/rating
-- passa pelo servidor do Next com a chave secreta (service_role).

create schema private;

-- ───────────────────────── Tabelas ─────────────────────────

create table public.teachers (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create unique index um_professor_so on public.teachers ((true));

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references public.teachers on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  join_code text not null unique,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index uma_turma_so on public.classes ((true));

create table public.students (
  id uuid primary key references auth.users on delete cascade,
  class_id uuid not null references public.classes on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  avatar text not null,
  initial_level text not null check (initial_level in ('iniciante', 'intermediario', 'avancado')),
  -- numeric (e não float8): a API devolve float8 com só 15 dígitos, e o rating lido
  -- precisa ser exatamente o gravado para o replay/auditoria bater até a última casa.
  rating numeric not null,
  rd numeric not null,
  last_played_at timestamptz,
  games_played int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index students_apelido_unico on public.students (class_id, lower(nickname));

-- PIN do aluno. RLS ligado e NENHUMA policy: só o servidor enxerga.
create table public.student_secrets (
  student_id uuid primary key references public.students on delete cascade,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes on delete cascade,
  white_id uuid not null references public.students on delete cascade,
  black_id uuid not null references public.students on delete cascade,
  white_score numeric(2, 1) not null check (white_score in (1, 0.5, 0)),
  mode text not null default 'presencial' check (mode in ('presencial', 'online')),
  rated boolean not null default true,
  status text not null default 'pendente' check (status in ('pendente', 'confirmada', 'recusada', 'anulada')),
  reported_by uuid not null references auth.users,
  confirmed_by uuid references auth.users,
  -- momento em que o rating foi aplicado (é o "playedAt" do Glicko e a ordem do replay)
  played_at timestamptz,
  white_rating_before numeric, white_rd_before numeric,
  white_rating_after numeric, white_rd_after numeric,
  black_rating_before numeric, black_rd_before numeric,
  black_rating_after numeric, black_rd_after numeric,
  pgn text,
  created_at timestamptz not null default now(),
  check (white_id <> black_id)
);
create index on public.games (class_id, played_at);
create index on public.games (white_id);
create index on public.games (black_id);

-- ───────────────────────── Ajudantes de RLS ─────────────────────────
-- security definer num schema NÃO exposto pela API, para as policies
-- consultarem students/classes sem recursão de RLS.

create function private.my_class_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select class_id from public.students where id = (select auth.uid()) and active
$$;

create function private.teaches(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classes where id = p_class and teacher_id = (select auth.uid()))
$$;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_secrets enable row level security;
alter table public.games enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.teachers, public.classes, public.students, public.games to authenticated;
grant all on all tables in schema public to service_role;

create policy "professor vê a si mesmo" on public.teachers for select to authenticated
  using (id = (select auth.uid()));

create policy "turma: professor dono, aluno da turma" on public.classes for select to authenticated
  using (teacher_id = (select auth.uid()) or id = (select private.my_class_id()));

create policy "aluno: colegas e professor" on public.students for select to authenticated
  using (class_id = (select private.my_class_id()) or (select private.teaches(class_id)));

create policy "partida: turma e professor" on public.games for select to authenticated
  using (class_id = (select private.my_class_id()) or (select private.teaches(class_id)));

-- ───────────────────────── Funções do servidor ─────────────────────────
-- Só service_role executa. O cálculo do Glicko é feito em TypeScript
-- (src/lib/glicko.ts); aqui só gravamos tudo de forma atômica.

-- Aplica o resultado de uma partida pendente: atualiza os dois alunos e a partida.
-- A trava na turma serializa as escritas de rating; o games_played esperado
-- detecta se alguém jogou entre a leitura e a gravação (o servidor tenta de novo).
create function public.apply_game_result(p jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  v_game public.games;
  n int;
begin
  select * into v_game from public.games where id = (p->>'game_id')::uuid for update;
  if v_game.id is null or v_game.status <> 'pendente' then
    raise exception 'partida não está pendente' using errcode = 'P0002';
  end if;
  perform 1 from public.classes where id = v_game.class_id for update;

  update public.students set
    rating = (p->>'white_rating_after')::numeric, rd = (p->>'white_rd_after')::numeric,
    last_played_at = (p->>'played_at')::timestamptz, games_played = games_played + 1
  where id = v_game.white_id and games_played = (p->>'white_games_played')::int;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'conflito' using errcode = '40001'; end if;

  update public.students set
    rating = (p->>'black_rating_after')::numeric, rd = (p->>'black_rd_after')::numeric,
    last_played_at = (p->>'played_at')::timestamptz, games_played = games_played + 1
  where id = v_game.black_id and games_played = (p->>'black_games_played')::int;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'conflito' using errcode = '40001'; end if;

  update public.games set
    status = 'confirmada',
    confirmed_by = (p->>'confirmed_by')::uuid,
    played_at = (p->>'played_at')::timestamptz,
    white_rating_before = (p->>'white_rating_before')::numeric, white_rd_before = (p->>'white_rd_before')::numeric,
    white_rating_after = (p->>'white_rating_after')::numeric, white_rd_after = (p->>'white_rd_after')::numeric,
    black_rating_before = (p->>'black_rating_before')::numeric, black_rd_before = (p->>'black_rd_before')::numeric,
    black_rating_after = (p->>'black_rating_after')::numeric, black_rd_after = (p->>'black_rd_after')::numeric
  where id = v_game.id;
end $$;

-- Anula uma partida e regrava o rating da turma inteira (replay feito no servidor).
create function public.apply_recalc(
  p_class uuid, p_void uuid, p_expected int, p_students jsonb, p_games jsonb
) returns void
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.classes where id = p_class for update;
  if (select count(*) from public.games where class_id = p_class and status = 'confirmada') <> p_expected then
    raise exception 'conflito' using errcode = '40001';
  end if;

  update public.games set status = 'anulada'
  where id = p_void and class_id = p_class and status = 'confirmada';
  if not found then raise exception 'partida não encontrada' using errcode = 'P0002'; end if;

  update public.students s set
    rating = x.rating, rd = x.rd, last_played_at = x.last_played_at, games_played = x.games_played
  from jsonb_to_recordset(p_students)
    as x(id uuid, rating numeric, rd numeric, last_played_at timestamptz, games_played int)
  where s.id = x.id and s.class_id = p_class;

  update public.games g set
    white_rating_before = x.white_rating_before, white_rd_before = x.white_rd_before,
    white_rating_after = x.white_rating_after, white_rd_after = x.white_rd_after,
    black_rating_before = x.black_rating_before, black_rd_before = x.black_rd_before,
    black_rating_after = x.black_rating_after, black_rd_after = x.black_rd_after
  from jsonb_to_recordset(p_games) as x(
    id uuid,
    white_rating_before numeric, white_rd_before numeric, white_rating_after numeric, white_rd_after numeric,
    black_rating_before numeric, black_rd_before numeric, black_rating_after numeric, black_rd_after numeric
  )
  where g.id = x.id and g.class_id = p_class;
end $$;

-- Conta a tentativa de PIN ANTES de conferir (atômico, à prova de tentativas
-- em paralelo) e devolve o hash; devolve nada se o aluno está bloqueado.
-- 5 tentativas → 15 minutos de bloqueio.
create function public.claim_pin_attempt(p_student uuid) returns text
language sql set search_path = '' as $$
  update public.student_secrets set
    failed_attempts = case when locked_until is not null then 1 else failed_attempts + 1 end,
    locked_until = case
      when locked_until is null and failed_attempts + 1 >= 5 then now() + interval '15 minutes'
    end
  where student_id = p_student and (locked_until is null or locked_until < now())
  returning pin_hash
$$;

revoke execute on function public.apply_game_result(jsonb) from public, anon, authenticated;
revoke execute on function public.apply_recalc(uuid, uuid, int, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.claim_pin_attempt(uuid) from public, anon, authenticated;
grant execute on function public.apply_game_result(jsonb) to service_role;
grant execute on function public.apply_recalc(uuid, uuid, int, jsonb, jsonb) to service_role;
grant execute on function public.claim_pin_attempt(uuid) to service_role;
