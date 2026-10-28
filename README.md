# My Body

Painel pessoal para acompanhar a evolucao de exames laboratoriais: importa PDFs com texto selecionavel, revisa os resultados e compara cada indicador entre coletas.

- Frontend: React, TypeScript, Vite, Recharts e PDF.js (leitura local no navegador).
- Servidor local: Express e SQLite nativo do Node 24, com login, sessoes e isolamento por usuario.
- Nao ha OCR, IA externa nem diagnostico automatico. Confira sempre os resultados com o laudo original.

## Demonstracao online

**Link:** https://fernandomagno.github.io/mybody/

O link publico e uma **demonstracao com dados ficticios**, sem login e sem banco de dados. O GitHub Pages hospeda apenas arquivos estaticos; por isso o armazenamento real so funciona no servidor local. A publicacao e feita pelo workflow [CI e GitHub Pages](.github/workflows/ci-pages.yml) a cada envio para a `main`.

## Uso no seu computador

Veja [SETUP.md](SETUP.md) para instalacao, banco SQLite, backups e acesso pelo celular.

```powershell
npm install
npm run dev
```

## Sistema completo no GitHub Codespaces

O sistema completo (login, banco SQLite e leitura de PDF) roda no Codespaces, ja configurado em `.devcontainer`.

1. No repositorio, clique em **Code**, **Codespaces** e **Create codespace on main**.
2. Aguarde a instalacao. O servidor inicia sozinho e abre a porta **3001** no navegador. Ela e **privada**: so voce, logado no GitHub, acessa.
3. Crie sua conta e guarde o codigo de recuperacao.
4. Para desligar, use **Stop codespace** em https://github.com/codespaces. Ao ligar de novo, o servidor reinicia sozinho.

O plano gratuito inclui 120 horas por mes de uso ativo. O banco fica dentro do codespace: **apagar o codespace apaga os dados**. Se o servidor nao subir, rode `npm start` no terminal.

## Verificacoes

```powershell
npm run lint
npm test
npm run build
```
