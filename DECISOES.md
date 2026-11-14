# Decisões

Escolhas feitas no caminho, da mais importante para a menos. Cada uma diz o que foi decidido, por quê e como desfazer.

## Rating

- **`daysToFullUncertainty` passou de 180 para 1000** (pedido: "igual ao chess.com", RD subindo devagar). Com 180, uma turma com aula semanal nunca saía do provisório: o RD subia entre uma aula e outra mais do que caía jogando. As constantes exatas do chess.com não são públicas; 1000 foi escolhido por simulação. É a única linha alterada em `src/lib/glicko.ts`; a matemática está intocada e coberta por valores "de ouro" em `glicko.test.ts`.
- **O corte de provisório continua em RD > 110**, como pedido. Consequência medida: numa turma fechada onde todos começam com RD 350, um aluno precisa de umas 30 a 40 partidas para entrar no ranking principal, e quem ganha (ou perde) quase sempre demora mais. Se quiser que entrem antes, o ajuste é `provisionalRd` (por exemplo 150).
- **Quem não joga há mais de 30 dias** sai do ranking (regra do `buildLeaderboard`). Para o aluno não sumir da tela, ele aparece em "Faz tempo que não jogam".
- **Rating e RD são `numeric` no banco, não `float8`.** A API do Supabase devolve `float8` com 15 dígitos, e o valor lido voltava diferente do gravado na última casa. Com `numeric`, o replay bate exatamente com o que está salvo.
- **O rating é aplicado na confirmação**, não no registro. `games.played_at` é esse momento: é o `playedAt` do Glicko e a ordem do replay.
- **Anular uma partida refaz a turma inteira** a partir do histórico (`replay` em `src/lib/rating.ts`). Simples e sempre correto; fica lento só com dezenas de milhares de partidas por turma.

## Contas e segurança

- **Sem fluxo de consentimento no site** (decisão do dono do projeto). O consentimento do art. 14 da LGPD precisa ser colhido fora (matrícula, por exemplo). Não existe tabela `consents`; para adicionar depois, basta uma tabela nova e um bloqueio no login do aluno.
- **Aluno é um usuário do Supabase Auth com e-mail interno** (`<uuid>@alunos.xadrez.local`) que ninguém vê. O servidor confere o PIN e abre a sessão com um token de uso único. Assim o RLS vale igual para todos os papéis. **A conferir no deploy:** se o Supabase hospedado aceita criar usuários com esse domínio (local aceita). Se recusar, troque `DOMINIO_ALUNO` em `src/app/acoes.ts` por um subdomínio seu.
- **PIN:** hash com scrypt; 5 tentativas e bloqueia por 15 minutos. A contagem é feita no banco antes de conferir, então tentativas em paralelo não escapam.
- **Login por lista de apelidos:** quem tem o código da turma vê apelidos e avatares. É o preço de não fazer criança de 6 anos digitar.
- **O papel (professor/aluno/responsável) vem das tabelas**, nunca de metadados do usuário.
- **Clientes só leem.** Aluno, partida e rating são gravados pelo servidor com a chave secreta. Exceção: o professor cria e renomeia turmas direto, protegido por RLS.
- **Responsável só vê o próprio filho.** Nas partidas do filho, o adversário aparece como "Colega".
- **Responsável entra por link no e-mail** (sem senha). O convite cria a conta; o e-mail fica em `guardians.email` para achar a conta num segundo convite.
- **Qualquer pessoa pode criar conta de professor.** Se quiser restringir, desligue o cadastro e crie os professores pelo painel.

## Produto e código

- **Server Actions no lugar de Route Handlers** para os formulários (`src/app/acoes.ts`). Continua tudo no servidor; é menos código e funciona sem JavaScript em quase todas as telas.
- **QR code por turma**, não por mesa: abre o login e cai direto em "Registrar partida".
- **Quem registrou não confirma a própria partida**; só o adversário ou o professor. Quem registrou pode cancelar.
- **A prévia "se ganhar / empatar / perder"** aparece para o aluno. O formulário do professor não mostra prévia.
- **Gráfico em SVG feito à mão**, sem biblioteca. Um ponto por partida.
- **Avatares:** peça de xadrez + cor (36 combinações). Sem imagens.
- **Ranking ao vivo (Realtime) fica para a Fase 2.** Na Fase 1 a página atualiza ao navegar.
- **Cache Components do Next 16 ficou ligado** (vira padrão na próxima versão). Como tudo depende de quem está logado, o conteúdo fica dentro de um `<Suspense>` no layout.
- **Nome "Xadrez da Turma"** é provisório.
- **Portas do Supabase local em 553xx** porque a 54322 já estava em uso nesta máquina.
- **Seed com 165 partidas, não ~50.** Com 50 (10 por aluno) o ranking principal ficaria vazio: todos ainda seriam provisórios.
