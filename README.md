# My Body

Painel pessoal para acompanhar a evolucao de exames laboratoriais: importa PDFs com texto selecionavel, revisa os resultados e compara cada indicador entre coletas.

- Frontend: React, TypeScript, Vite, Recharts e PDF.js (leitura local no navegador).
- Servidor local: Express e SQLite nativo do Node 24, com login, sessoes e isolamento por usuario.
- Nao ha OCR, IA externa nem diagnostico automatico. Confira sempre os resultados com o laudo original.

## Demonstracao online

O link publico e uma **demonstracao com dados ficticios**, sem login e sem banco de dados. O GitHub Pages hospeda apenas arquivos estaticos; por isso o armazenamento real so funciona no servidor local.

## Uso no seu computador

Veja [SETUP.md](SETUP.md) para instalacao, banco SQLite, backups e acesso pelo celular.

```powershell
npm install
npm run dev
```

## Verificacoes

```powershell
npm run lint
npm test
npm run build
```
