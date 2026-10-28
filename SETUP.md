# My Body: exames pessoais com SQLite

React + TypeScript no navegador, API Express no Node e arquivo SQLite local. Nao precisa de conta externa, chaves de acesso, servico de e-mail ou Supabase. O relatorio HTML da pasta superior permanece intacto.

## Iniciar no seu computador

Requer Node **24 LTS ou superior**, com suporte a `node:sqlite`.

```powershell
cd C:\mommy\exames-dashboard
npm install
npm run dev
```

O comando inicia a API em `http://127.0.0.1:3001` e o dashboard em `http://127.0.0.1:5173`. Ambas as portas precisam estar livres. A API escuta apenas o proprio computador. O banco e criado automaticamente em `data/linha.sqlite`, com tabelas de usuarios, sessoes e exames. O caminho e resolvido em relacao a pasta do projeto, nao ao diretorio do terminal.

Abra o dashboard e clique em **Criar uma conta**. Use e-mail como identificador e uma senha de 12 a 128 caracteres. O cadastro nao verifica nem envia e-mail. Guarde o codigo de recuperacao exibido uma unica vez em um gerenciador de senhas; ele permite redefinir a senha em **Esqueci a senha**. Ao recuperar, todas as sessoes antigas sao revogadas e um novo codigo e exibido. Sem senha nem codigo, nao ha recuperacao automatica por e-mail.

As sessoes expiram em ate 8 horas, usam cookie HttpOnly/SameSite Strict e sao revogadas ao sair. Atualizar a pagina mantem o login enquanto a sessao e valida. Senhas usam scrypt com salt aleatorio; tokens de sessao e codigos de recuperacao sao armazenados apenas como hashes. A API exige autenticacao e filtra todos os acessos a exames pelo usuario da sessao, nunca por um user_id informado pelo navegador. Ha limite de tentativas e verificacao de origem nas operacoes de escrita.

O modo de demonstracao continua separado e somente em memoria. Nenhuma conta de teste e criada automaticamente para o usuario. O servidor recebe apenas os resultados revisados; PDF e texto bruto continuam no navegador. Nao ha IA externa, OCR nem diagnostico automatico. PDF escaneado ou nao reconhecido exige preenchimento manual. Referencias sugeridas devem ser conferidas no laudo; tabelas dependentes de idade/sexo nao sao interpretadas automaticamente. Unidades diferentes nao sao convertidas nem comparadas.

## Cobertura da importacao

O leitor reconhece os grupos dos dois laudos de exemplo fornecidos localmente: hemograma (incluindo valores relativos e absolutos), coagulação, funcao renal, eletrólitos, perfil lipidico, enzimas, vitaminas, tireoide, hormonios sexuais, testosterona total/livre calculada/biodisponivel, PSA e os componentes qualitativos do FAN. A validacao local encontrou 76 registros distintos no primeiro PDF e 59 no segundo; valores repetidos do mesmo indicador/unidade no mesmo laudo sao deduplicados. Resultados historicos impressos dentro do PDF nao viram uma nova coleta.

O leitor preserva milhares nas contagens, decimais brasileiros, nomes em varias linhas e artefatos de ligatura do texto PDF. Na revisao, **Numero exato** e usado para medidas numericas; **Texto / limite** preserva respostas como "Nao Reagente" ou "Inferior a 0,3". Esses resultados textuais sao gravados e aparecem em tabela propria no dashboard, mas nao geram grafico nem variacao percentual como se fossem medidas exatas. Registros numericos antigos continuam compativeis.

Importacao nao equivale a interpretacao clinica nem garante leitura de todo modelo de laboratorio. Confira todos os campos, referencias e unidades; use inclusao manual quando necessario. Laudos ja salvos nao sao reprocessados automaticamente: para completar um registro antigo, exclua somente a versao incompleta e importe novamente o mesmo PDF, conferindo tudo antes de confirmar. Os dois PDFs de validacao nao sao enviados ao banco durante os testes.

## Banco local e backups

- `data/linha.sqlite` contem contas, resultados e metadados. O arquivo **nao e criptografado**; qualquer pessoa com acesso ao arquivo pode ler os resultados ou alterar as contas. Proteja o usuario do Windows e utilize criptografia de disco, como BitLocker quando disponivel.
- `data/`, arquivos `.sqlite` e respectivos WAL/journal sao ignorados pelo Git. Nao os envie ao repositorio ou ao chat. Nomes de arquivo de PDF tambem podem conter dados pessoais.
- Para backup simples e consistente, encerre o sistema e copie **toda a pasta data** para um local protegido/criptografado. Para restaurar, com o sistema desligado, restaure a pasta completa. Nao copie apenas o arquivo principal enquanto o servidor escreve: o modo WAL pode manter alteracoes em arquivos auxiliares.
- A exclusao de um exame remove seu registro ativo, mas copias de seguranca e possiveis fragmentos nos arquivos do banco podem continuar contendo dados. Defina retencao e descarte dos backups. Nao ha exclusao automatica da conta pela interface; o administrador local deve tratar essa solicitacao com cuidado.
- O esquema e inicializado automaticamente. Dados de um Supabase externo nao sao importados por esta troca. Exames da antiga demonstracao nao eram persistentes.

## Configuracao opcional

Por padrao nao e necessario `.env.local`. O exemplo `.env.example` documenta `DB_PATH`, `PORT`, `HOST` e `COOKIE_SECURE`; o servidor carrega `.env.local` se existir. O frontend usa `/api` na mesma origem, com proxy Vite para a porta 3001. Se mudar a porta da API, ajuste tambem o proxy em `vite.config.ts`.

Para servir a versao compilada, sem servidor Vite:

```powershell
npm run build
npm start
```

Abra `http://127.0.0.1:3001`. Os cabecalhos de seguranca sao aplicados pelo Express/Helmet, incluindo CSP sem dominios Supabase. Fontes, PDF.js e worker sao servidos localmente.

## Publicacao futura

Esta entrega fica no computador local, nao e publicada automaticamente. Para uso online, e necessario servidor Node 24 com **disco persistente**, backup, HTTPS e revisao de seguranca/privacidade. Hospedagem puramente estatica ou funcoes sem disco persistente nao servem para este banco SQLite. Configure `APP_ORIGIN` com a origem HTTPS exata, `COOKIE_SECURE=true` e `HOST=0.0.0.0` apenas atras de um proxy HTTPS confiavel; a API recusa exposicao fora do loopback sem essas configuracoes. Nao habilite trust proxy indiscriminadamente. O limite de tentativas pode agrupar usuarios pelo IP do proxy; revise a topologia antes de publicar.

Para dados reais de saude, defina finalidade, acesso administrativo, retencao, backups e suporte. Este MVP nao representa certificacao de conformidade com a LGPD. Nao use gravacao de sessao ou logs de resultados/senhas/codigos.

## Verificacao

```powershell
npm test
npm run test:laudos
npm run lint
npm run build
```

O executor nativo do Node testa as regras dos indicadores e a API com SQLite temporario: cadastro, hash, login, cookies, acesso sem sessao, origem indevida, duas contas isoladas, tentativa de forjar user_id, validacao dos exames, exclusao, recuperacao e rotacao de codigo, revogacao/expiracao de sessoes, limite de tentativas e persistencia apos reiniciar. Os testes usam apenas dados ficticios e removem o banco temporario ao terminar.

`test:laudos` e uma checagem adicional dos dois arquivos PDF na pasta superior do workspace. Ela le os arquivos localmente, verifica cobertura e confere os resultados atuais de testosterona contra a fonte sem copiar valores pessoais para fixtures ou gravar exames. Se os arquivos nao estiverem presentes, esses dois casos sao marcados como ignorados. Nao inclua os PDFs reais no Git.