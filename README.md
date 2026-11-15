# Xadrez da Turma

Plataforma de xadrez para alunos de 6 a 14 anos: partidas entre colegas, rating Glicko-1 e ranking da turma.
Fase 1 (base): um professor, uma turma, registro de partida presencial, ranking, Novatos e página do aluno.

As decisões tomadas no caminho estão em [DECISOES.md](DECISOES.md).

## Rodar localmente

Precisa de Node 24 e pnpm. O banco é um arquivo SQLite (`data/xadrez.db`), criado sozinho; não há Docker nem serviço para subir.

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
| `pnpm test` | Vitest. Os testes de integração usam um SQLite em memória |
| `pnpm lint` / `pnpm typecheck` | ESLint e TypeScript |
| `pnpm db:reset` | Apaga o banco local e roda o seed |

## Onde está cada coisa

- `src/lib/glicko.ts`: a matemática do rating. Não mexer.
- `src/lib/rating.ts`: ponte entre o banco e o Glicko (cálculo de uma partida e replay da turma).
- `src/lib/partidas.ts`: registrar, confirmar, recusar e anular partida.
- `src/app/acoes.ts`: todas as Server Actions (login, alunos, partidas).
- `src/lib/db.ts`: a conexão com o SQLite e o esquema das tabelas.
- `src/lib/sessao.ts`: login por cookie (quem está navegando).

## Deploy

O banco é um arquivo, então o site precisa rodar num servidor com **disco persistente** (VPS, ou Fly/Railway/Render com volume). Na Vercel o disco some a cada deploy: lá não funciona.

1. `pnpm build && pnpm start`, com `NEXT_PUBLIC_SITE_URL` (endereço público, usado no QR) e `DATABASE_PATH` apontando para o volume.
2. Sirva por HTTPS: o cookie de sessão é `Secure` em produção.
3. Abra `/professor` logo em seguida e crie a senha: quem chegar primeiro define a senha do professor.
4. Backup: `sqlite3 xadrez.db ".backup copia.db"` (não copie o arquivo solto com o site rodando).
