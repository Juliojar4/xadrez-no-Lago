# Xadrez da Turma

Plataforma de xadrez para alunos de 6 a 14 anos: partidas entre colegas, rating Glicko-1 e ranking da turma.
Fase 1 (base): contas, turmas, registro de partida presencial, ranking, Novatos e página do aluno.

As decisões tomadas no caminho estão em [DECISOES.md](DECISOES.md).

## Rodar localmente

Precisa de Node 24, pnpm e Docker.

```bash
pnpm install
pnpm db:start                 # sobe o Supabase local (demora na primeira vez)
cp .env.example .env.local    # preencha as chaves com `pnpm exec supabase status`
pnpm db:reset                 # aplica as migrações e cria a turma de demonstração
pnpm dev                      # http://localhost:3000
```

Contas da turma de demonstração (só existem no banco local):

| Quem | Como entrar |
|---|---|
| Professor | `prof@exemplo.com`, senha `xadrez123` |
| Alunos | código `XADREZ`, escolha um apelido, PIN `1234` |
| Responsável | `responsavel@exemplo.com`; o link chega no Mailpit (http://127.0.0.1:55324) |

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm test` | Vitest. Os testes de integração usam o Supabase local e são pulados sem ele |
| `pnpm lint` / `pnpm typecheck` | ESLint e TypeScript |
| `pnpm db:reset` | Zera o banco local, reaplica as migrações e roda o seed |
| `pnpm db:types` | Regenera `src/lib/tipos.ts` depois de mudar o banco |

## Onde está cada coisa

- `src/lib/glicko.ts`: a matemática do rating. Não mexer.
- `src/lib/rating.ts`: ponte entre o banco e o Glicko (cálculo de uma partida e replay da turma).
- `src/lib/partidas.ts`: registrar, confirmar, recusar e anular partida.
- `src/app/acoes.ts`: todas as Server Actions (login, turmas, alunos, partidas).
- `supabase/migrations/`: tabelas, RLS e as funções que gravam o rating de forma atômica.

## Deploy (Vercel + Supabase)

1. Aplique as migrações no projeto Supabase (`supabase db push`).
2. Na Vercel, defina `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e `NEXT_PUBLIC_SITE_URL`.
3. No painel do Supabase (Auth): ponha a URL do site em "Site URL" e cole os HTMLs de `supabase/templates/` nos modelos "Invite user" e "Magic Link". Sem isso, os links de e-mail dos responsáveis não funcionam.
4. Confira se dá para cadastrar um aluno (veja a nota sobre o e-mail interno em DECISOES.md).
