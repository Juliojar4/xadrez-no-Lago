# Xadrez da Turma

Plataforma de xadrez para alunos de 6 a 14 anos: partidas entre colegas, rating Glicko-1 e ranking.
As turmas são organizadas por **cidade → local**: cada local (escola, clube…) tem os seus alunos e o seu ranking.

- **Aluno:** escolhe a cidade, o local e digita o PIN (cidade com um local só cai direto no PIN).
- **Professor:** um por cidade. Entra com a senha da cidade, cria os locais e cadastra os alunos.
- **Administrador:** cria as cidades e a senha do professor de cada uma, em `/admin`.

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
| Administrador | `/admin`, senha `admin123` |
| Professor | Brasília ou Goiânia, senha `xadrez123` |
| Alunos | Brasília · Escola do Lago: PINs `1001` a `1010` · Clube de Xadrez: `2001`, `2002` · Goiânia: `3001`, `3002` |

Para ver o primeiro acesso (tela de criar a senha do administrador), apague a pasta `data/` e abra `/admin`.

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
- `src/app/acoes.ts`: todas as Server Actions (login, cidades, locais, alunos, partidas).
- `src/lib/db.ts`: a conexão com o SQLite e o esquema das tabelas.
- `src/lib/sessao.ts`: login por cookie (quem está navegando).

## Deploy (Vercel + Turso)

1. O banco Turso é criado pelo Marketplace da Vercel (`vercel integration add tursocloud/database`), que já cadastra `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` no projeto. As tabelas são criadas sozinhas no primeiro acesso.
2. Defina `NEXT_PUBLIC_SITE_URL` com o endereço público (é o que vai no QR).
3. Abra `/admin` logo em seguida e crie a senha: quem chegar primeiro define a senha do administrador. Depois crie as cidades.

Nunca ponha as variáveis `TURSO_*` de produção no `.env.local`: o `pnpm db:seed` grava no banco para onde elas apontam.
