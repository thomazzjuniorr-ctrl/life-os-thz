# Deploy Online

## Caminho principal

Para este projeto, o caminho principal agora e:

- `GitHub` para guardar o codigo
- `Vercel` para publicar
- `HostGator` para apontar o dominio depois

Esse fluxo combina bem com o app porque ele e um projeto estatico, com build para `dist`, e funciona muito bem no modelo `importar repositorio -> buildar -> publicar`.

## O que ja esta pronto no projeto

- `vercel.json` com:
  - `buildCommand`
  - `outputDirectory`
  - `headers` de seguranca
- `package.json` com scripts de `build`, `preview`, `test` e `lint`
- `runtime-config.js` preparado para configuracao publica por ambiente
- `src/services/auth-service.js` pronto para futura autenticacao com Google
- `manifest.webmanifest` e `public/icons/*` como base para futura etapa PWA
- `.gitignore` preparado para evitar subir artefatos locais

## Revisao de prontidao para Vercel

O projeto esta pronto para deploy na Vercel com estas configuracoes:

- Framework preset: `Other`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Node version: `22` ou superior

## Arquivos que devem ir para o GitHub

Suba estes arquivos e pastas:

- `.gitignore`
- `.nvmrc`
- `package.json`
- `package-lock.json`
- `vercel.json`
- `index.html`
- `styles.css`
- `favicon.svg`
- `manifest.webmanifest`
- `runtime-config.js`
- `eslint.config.mjs`
- `playwright.config.mjs`
- `README.md`
- pasta `src/`
- pasta `public/`
- pasta `tools/`
- pasta `tests/`
- pasta `docs/`
- pasta `scripts/`

## Arquivos e pastas que nao devem ir para o GitHub

Nao suba:

- `node_modules/`
- `dist/`
- `playwright-report/`
- `test-results/`
- `.vercel/`
- `.netlify/`
- arquivos temporarios como `tmp-*.png`

## Protecao inicial de acesso

Para `Vercel`, o cenario mais realista hoje e:

- `Vercel Authentication` existe em todos os planos
- no plano `Hobby`, a protecao padrao cobre `preview deployments` e URLs de deploy
- no plano `Hobby`, o dominio de producao continua publico
- `Password Protection` para producao exige `Enterprise` ou add-on/recursos de `Pro`

Entao, para a sua fase atual:

- publique primeiro na URL `vercel.app`
- se quiser acesso inicial mais controlado, use `Vercel Authentication` nas previews
- nao coloque dados sensiveis reais no app ainda
- quando quiser acesso privado de verdade no dominio final, evolua para login Google ou recurso pago de protecao da Vercel

Importante:

- nao recomendo uma "senha em JavaScript" no front-end como protecao real
- isso pode servir como barreira visual, mas nao como seguranca de verdade

## Dominio HostGator depois

Quando quiser usar seu dominio proprio:

1. adicione o dominio no projeto da Vercel
2. copie os registros DNS pedidos pela Vercel
3. abra o painel da HostGator
4. edite os registros DNS do dominio
5. aguarde propagacao

O mais comum sera:

- `A record` para o dominio raiz
- `CNAME` para `www`

Sempre siga exatamente os registros exibidos pela propria Vercel no momento da configuracao.

## Proxima evolucao recomendada

Depois da publicacao:

1. conectar dominio da HostGator
2. configurar autenticacao Google
3. transformar em PWA instalavel
