# Life OS Thz 2026

Workspace pessoal para integrar vida, saude, familia, casa, mudanca, financeiro pessoal e projetos de trabalho em um unico sistema com clareza operacional.

## Stack

- HTML
- CSS
- JavaScript ES Modules
- IndexedDB
- Node.js
- Playwright
- ESLint

## Requisitos

- Node.js 22+
- npm 11+

## Comandos

Instalar:

```powershell
npm install
```

Rodar localmente:

```powershell
npm run dev
```

Abrir:

- `http://127.0.0.1:4173`

Testar:

```powershell
npm test
```

Build:

```powershell
npm run build
```

Preview do build:

```powershell
npm run preview
```

Deploy:

```powershell
npm run deploy:netlify:preview
npm run deploy:netlify:prod
npm run deploy:vercel:prod
```

## Deploy Online

A recomendacao atual para este app e `Vercel` usando `GitHub web + Vercel web`.

Arquivos preparados:

- [netlify.toml](./netlify.toml)
- [vercel.json](./vercel.json)
- [runtime-config.js](./runtime-config.js)
- [manifest.webmanifest](./manifest.webmanifest)

Guia completo:

- [docs/deploy-online.md](./docs/deploy-online.md)
- [docs/github-vercel-publish.md](./docs/github-vercel-publish.md)

## Base para evolucao futura

- `runtime-config.js` para configuracao publica por ambiente
- `src/services/runtime-config.js` para leitura centralizada
- `src/services/auth-service.js` para futura autenticacao Google
- `src/services/google-calendar.js` preparado para usar runtime config
- `netlify/functions/` reservado para auth e integracoes privadas

## Arquivos principais

- [index.html](./index.html)
- [styles.css](./styles.css)
- [src/app.js](./src/app.js)
- [src/utils/engine.js](./src/utils/engine.js)
- [src/services/google-calendar.js](./src/services/google-calendar.js)
- [src/services/runtime-config.js](./src/services/runtime-config.js)
- [src/services/auth-service.js](./src/services/auth-service.js)
- [docs/deploy-online.md](./docs/deploy-online.md)
