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

- **Um professor e uma turma só** (decisão do dono do projeto). No primeiro acesso, a tela do professor pede para criar a senha; isso cria o professor e a turma. Depois ele entra só com a senha. Dois índices únicos no banco impedem um segundo professor ou uma segunda turma. As tabelas `teachers` e `classes` continuam existindo, com uma linha cada.
- **Quem abrir o site primeiro define a senha do professor.** Crie a senha logo depois do deploy.
- **Não há recuperação de senha do professor** (não há e-mail). Para trocar: apague a linha do professor em `secrets` e grave um hash novo (`gravarSegredo` em `src/lib/pin.ts`).
- **Sem área de pais/responsáveis** (decisão do dono do projeto). Não há tabelas, convites nem e-mails; o site não envia e-mail nenhum.

- **Sem fluxo de consentimento no site** (decisão do dono do projeto). O consentimento do art. 14 da LGPD precisa ser colhido fora (matrícula, por exemplo). Não existe tabela `consents`; para adicionar depois, basta uma tabela nova e um bloqueio no login do aluno.
- **Banco em SQLite, num arquivo só** (`data/xadrez.db`, pelo `node:sqlite` que já vem no Node 24; nenhuma dependência). Troca feita para simplificar: sem Docker, sem Supabase, sem chaves. O preço: o site precisa de um servidor com disco persistente (não roda na Vercel) e de um processo só gravando. Para voltar a um banco hospedado, o SQL está concentrado em `src/lib/` (`db.ts`, `consultas.ts`, `partidas.ts`, `pin.ts`, `sessao.ts`) e em `src/app/acoes.ts`.
- **Sessão própria por cookie.** Ao acertar o PIN/senha, o servidor sorteia um token, guarda só o hash dele na tabela `sessions` e manda o token num cookie `HttpOnly`. Vale 30 dias; "Sair" apaga a linha.
- **Não há mais RLS:** o navegador nunca fala com o banco. Cada página e cada Server Action confere quem pede (`exigirAluno`, `exigirProfessor`, `getViewer`) antes de ler ou gravar.
- **PIN e senha do professor:** hash com scrypt; 5 tentativas e bloqueia por 15 minutos. A contagem é feita no banco antes de conferir, então tentativas em paralelo não escapam. Vale também para o professor (alguém errando a senha de propósito trava o login dele por 15 minutos).
- **Login por lista de apelidos:** quem tem o código da turma vê apelidos e avatares. É o preço de não fazer criança de 6 anos digitar.
- **O papel (professor ou aluno) vem das tabelas**, nunca de metadados do usuário.
- **O navegador não tem acesso ao banco.** Tudo é lido e gravado pelo servidor.

## Produto e código

- **Server Actions no lugar de Route Handlers** para os formulários (`src/app/acoes.ts`). Continua tudo no servidor; é menos código e funciona sem JavaScript em quase todas as telas.
- **Um QR code para a turma**, não por mesa: abre o login e cai direto em "Registrar partida".
- **Quem registrou não confirma a própria partida**; só o adversário ou o professor. Quem registrou pode cancelar.
- **A prévia "se ganhar / empatar / perder"** aparece para o aluno. O formulário do professor não mostra prévia.
- **Gráfico em SVG feito à mão**, sem biblioteca. Um ponto por partida.
- **Avatares:** peça de xadrez + cor (36 combinações). Sem imagens.
- **Ranking ao vivo (Realtime) fica para a Fase 2.** Na Fase 1 a página atualiza ao navegar.
- **Cache Components do Next 16 ficou ligado** (vira padrão na próxima versão). Como tudo depende de quem está logado, o conteúdo fica dentro de um `<Suspense>` no layout.
- **Nome "Xadrez da Turma"** é provisório.
- **Seed com 165 partidas, não ~50.** Com 50 (10 por aluno) o ranking principal ficaria vazio: todos ainda seriam provisórios.
