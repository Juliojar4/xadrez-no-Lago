# Decisões

Escolhas feitas no caminho, da mais importante para a menos. Cada uma diz o que foi decidido, por quê e como desfazer.

## Rating

- **`daysToFullUncertainty` passou de 180 para 1000** (pedido: "igual ao chess.com", RD subindo devagar). Com 180, uma turma com aula semanal nunca saía do provisório: o RD subia entre uma aula e outra mais do que caía jogando. As constantes exatas do chess.com não são públicas; 1000 foi escolhido por simulação. É a única linha alterada em `src/lib/glicko.ts`; a matemática está intocada e coberta por valores "de ouro" em `glicko.test.ts`.
- **O corte de provisório continua em RD > 110**, como pedido. Consequência medida: numa turma fechada onde todos começam com RD 350, um aluno precisa de umas 30 a 40 partidas para entrar no ranking principal, e quem ganha (ou perde) quase sempre demora mais. Se quiser que entrem antes, o ajuste é `provisionalRd` (por exemplo 150).
- **Quem não joga há mais de 30 dias** sai do ranking (regra do `buildLeaderboard`). Para o aluno não sumir da tela, ele aparece em "Faz tempo que não jogam".
- **Rating e RD são `real` no SQLite**, que guarda o número do JavaScript sem perder nenhuma casa: o replay bate exatamente com o que está salvo.
- **O rating é aplicado na confirmação**, não no registro. `games.played_at` é esse momento: é o `playedAt` do Glicko e a ordem do replay.
- **Anular uma partida refaz a turma inteira** a partir do histórico (`replay` em `src/lib/rating.ts`). Simples e sempre correto; fica lento só com dezenas de milhares de partidas por turma.

## Contas e segurança

- **Cidades → locais → alunos** (decisão do dono do projeto, no lugar do código da turma). Cada local é uma turma: tem os seus alunos, o seu ranking, e só há partidas entre alunos do mesmo local.
- **Um professor por cidade, sem conta própria:** o professor "é" a cidade. A senha fica guardada na chave da cidade e ele administra todos os locais dela. Não enxerga alunos nem partidas de outra cidade (toda leitura e gravação do professor confere a cidade).
- **Um administrador** cria as cidades e a senha de cada professor, e troca a senha de quem esqueceu (`/admin`). **Quem abrir `/admin` primeiro define a senha do administrador:** crie logo depois do deploy. Não há recuperação dessa senha (não há e-mail); para trocar, apague a linha `admin` da tabela `secrets` e abra `/admin` de novo.
- **O aluno entra só com o PIN**, sem escolher o apelido (pedido do dono do projeto: cidade, local, PIN). Consequências:
  - Dentro de um local não há dois PINs iguais (índice único). O PIN é sorteado pelo site.
  - O hash do PIN usa o local como sal (não um sal por aluno), porque é pelo par (local, PIN) que o aluno é encontrado.
  - **É mais fraco que apelido + PIN:** quem chuta um PIN qualquer entra na conta de quem tiver aquele PIN. Com 30 alunos num local, 1 chute em cada 333 acerta alguém. A trava é por endereço IP: 10 erros seguidos bloqueiam aquele IP, naquele local, por 15 minutos (por IP e não por local, para ninguém de fora travar a turma). Se virar problema, aumente `PIN_DIGITOS` em `src/lib/dominio.ts` para 6 (os PINs antigos precisam ser gerados de novo).
  - O que um invasor consegue: ver o ranking do local e registrar/confirmar partidas em nome daquele aluno. O professor anula a partida e gera um PIN novo.
- **A lista de cidades e locais é pública.** Apelidos e avatares só aparecem depois do PIN.
- **Sem área de pais/responsáveis** (decisão do dono do projeto). Não há tabelas, convites nem e-mails; o site não envia e-mail nenhum.

- **Sem fluxo de consentimento no site** (decisão do dono do projeto). O consentimento do art. 14 da LGPD precisa ser colhido fora (matrícula, por exemplo). Não existe tabela `consents`; para adicionar depois, basta uma tabela nova e um bloqueio no login do aluno.
- **Banco em SQLite: Turso em produção, arquivo local no desenvolvimento** (`@libsql/client`, o mesmo código nos dois). Troca feita para simplificar: sem Docker, sem Supabase Auth, sem RLS. O Turso entrou porque a Vercel não tem disco persistente para um arquivo SQLite. O SQL está concentrado em `src/lib/` (`db.ts`, `consultas.ts`, `partidas.ts`, `pin.ts`, `sessao.ts`) e em `src/app/acoes.ts`.
- **O esquema é criado sozinho** (`create table if not exists` em `db.ts`, uma vez por processo). Não há migrações: para mudar uma tabela que já tem dados, escreva o `alter table`.
- **Sessão própria por cookie.** Ao acertar o PIN/senha, o servidor sorteia um token, guarda só o hash dele na tabela `sessions` e manda o token num cookie `HttpOnly`. Vale 30 dias; "Sair" apaga a linha.
- **Não há mais RLS:** o navegador nunca fala com o banco. Cada página e cada Server Action confere quem pede (`exigirAluno`, `exigirProfessor`, `getViewer`) antes de ler ou gravar.
- **Senhas (administrador e professores):** hash com scrypt; 5 erros seguidos bloqueiam aquela conta por 15 minutos. A contagem é feita no banco antes de conferir, então tentativas em paralelo não escapam. Alguém errando de propósito trava o login daquela conta por 15 minutos.
- **O papel (administrador, professor ou aluno) vem das tabelas**, nunca de metadados do usuário.
- **O navegador não tem acesso ao banco.** Tudo é lido e gravado pelo servidor.

## Produto e código

- **Server Actions no lugar de Route Handlers** para os formulários (`src/app/acoes.ts`). Continua tudo no servidor; é menos código e funciona sem JavaScript em quase todas as telas.
- **Um QR code por local**, não por mesa: abre o PIN daquele local e cai direto em "Registrar partida".
- **Quem registrou não confirma a própria partida**; só o adversário ou o professor. Quem registrou pode cancelar.
- **A prévia "se ganhar / empatar / perder"** aparece para o aluno. O formulário do professor não mostra prévia.
- **Gráfico em SVG feito à mão**, sem biblioteca. Um ponto por partida.
- **Avatares:** peça de xadrez + cor (36 combinações). Sem imagens.
- **Ranking ao vivo (Realtime) fica para a Fase 2.** Na Fase 1 a página atualiza ao navegar.
- **Cache Components do Next 16 ficou ligado** (vira padrão na próxima versão). Como tudo depende de quem está logado, o conteúdo fica dentro de um `<Suspense>` no layout.
- **Nome "Xadrez da Turma"** é provisório.
- **Seed com 165 partidas, não ~50.** Com 50 (10 por aluno) o ranking principal ficaria vazio: todos ainda seriam provisórios.
