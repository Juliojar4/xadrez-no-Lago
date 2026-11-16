# Xadrez da Turma

Plataforma de xadrez para alunos de 6 a 14 anos: partidas entre colegas, rating Glicko-1 e ranking da turma.
Fase 1 (base): um professor, uma turma, registro de partida presencial, ranking, Novatos e página do aluno.

As decisões tomadas no caminho estão em [DECISOES.md](DECISOES.md).

## Rodar localmente

Precisa de Node 24 e pnpm. Localmente o banco é um arquivo SQLite (`data/xadrez.db`), criado sozinho; não há Docker nem serviço para subir. Em produção é o Turso (SQLite hospedado).

```bash
pnpm install
pnpm db:reset                 # opcional: apaga o banco e cria os dados de demonstração
pnpm dev                      # http://localhost:3000
```

Contas de demonstração (criadas pelo `pnpm db:reset`):

| Quem | Como entrar |
|---|---|
| Professor | senha `xadrez123` |
| Alunos | código `XADREZ`, escolha um apelido, PIN `1234` |

Para ver o primeiro acesso (tela de criar a senha do professor), apague a pasta `data/` e abra o site.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm test` | Vitest. Os testes de integração usam um arquivo SQLite temporário |
| `pnpm lint` / `pnpm typecheck` | ESLint e TypeScript |
| `pnpm db:reset` | Apaga o banco local e roda o seed |

## Onde está cada coisa

- `src/lib/glicko.ts`: a matemática do rating. Não mexer.
- `src/lib/rating.ts`: ponte entre o banco e o Glicko (cálculo de uma partida e replay da turma).
- `src/lib/partidas.ts`: registrar, confirmar, recusar e anular partida.
- `src/app/acoes.ts`: todas as Server Actions (login, alunos, partidas).
- `src/lib/db.ts`: a conexão com o SQLite e o esquema das tabelas.
- `src/lib/sessao.ts`: login por cookie (quem está navegando).

## Deploy (Vercel + Turso)

1. O banco Turso é criado pelo Marketplace da Vercel (`vercel integration add tursocloud/database`), que já cadastra `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` no projeto. As tabelas são criadas sozinhas no primeiro acesso.
2. Defina `NEXT_PUBLIC_SITE_URL` com o endereço público (é o que vai no QR).
3. Abra `/professor` logo em seguida e crie a senha: quem chegar primeiro define a senha do professor.

Nunca ponha as variáveis `TURSO_*` de produção no `.env.local`: o `pnpm db:seed` grava no banco para onde elas apontam.
