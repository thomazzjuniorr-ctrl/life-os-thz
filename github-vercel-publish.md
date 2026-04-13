# GitHub + Vercel Sem Terminal

## Objetivo

Publicar o `Life OS Thz 2026` usando apenas:

- interface web do `GitHub`
- interface web da `Vercel`

## Antes de comecar

Tenha em maos:

- conta no GitHub
- conta na Vercel
- pasta local do projeto

## Passo 1 - Criar o repositorio no GitHub

1. Entre em `https://github.com`
2. Clique em `New`
3. Em `Repository name`, use algo como `life-os-thz-2026`
4. Deixe como `Private` se quiser mais privacidade
5. Nao marque:
   - `Add a README file`
   - `Add .gitignore`
   - `Choose a license`
6. Clique em `Create repository`

## Passo 2 - Enviar os arquivos pela interface web

Na tela vazia do repositiorio:

1. Clique em `uploading an existing file`
2. Arraste para a pagina apenas estes arquivos e pastas:

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
- pasta `src`
- pasta `public`
- pasta `tools`
- pasta `tests`
- pasta `docs`
- pasta `scripts`

3. Nao envie:

- `node_modules`
- `dist`
- `playwright-report`
- `test-results`
- `.vercel`
- `.netlify`

4. Em `Commit changes`, escreva:
   - `Initial production-ready upload`
5. Clique em `Commit changes`

## Passo 3 - Conectar o GitHub na Vercel

1. Entre em `https://vercel.com`
2. Clique em `Add New...`
3. Clique em `Project`
4. Escolha `Import Git Repository`
5. Autorize acesso ao GitHub, se a Vercel pedir
6. Selecione o repositorio `life-os-thz-2026`

## Passo 4 - Configurar o projeto na Vercel

Na tela de importacao:

- `Framework Preset`: `Other`
- `Root Directory`: deixe vazio ou `/`
- `Install Command`: `npm install`
- `Build Command`: `npm run build`
- `Output Directory`: `dist`

Se aparecer configuracao de Node:

- use `Node 22`

Depois clique em `Deploy`

## Passo 5 - Confirmar a publicacao

Depois que a Vercel terminar:

1. clique em `Visit`
2. abra a URL publica gerada
3. confirme:
   - a home abre
   - a tela `Hoje` aparece
   - a navegacao funciona
   - o layout carrega normalmente

## Passo 6 - Abrir no celular

Depois da publicacao:

1. copie a URL publica da Vercel
2. abra no navegador do celular
3. se quiser atalho:
   - no iPhone: `Compartilhar` -> `Adicionar a Tela de Inicio`
   - no Android: menu do navegador -> `Adicionar a tela inicial`

## Passo 7 - Apontar dominio da HostGator depois

Quando quiser usar seu dominio proprio:

1. no projeto da Vercel, abra `Settings`
2. abra `Domains`
3. clique em `Add`
4. informe seu dominio
5. a Vercel vai mostrar os registros DNS necessarios
6. abra a HostGator
7. entre na area do dominio
8. edite o DNS usando exatamente os registros exibidos pela Vercel
9. volte na Vercel e aguarde a validacao

## Protecao inicial

Caminho realista para esta fase:

- repositorio `Private` no GitHub
- deploy na Vercel
- sem dados sensiveis reais no app
- evoluir depois para login com Google

Na Vercel:

- `Vercel Authentication` pode proteger previews
- no plano `Hobby`, o dominio de producao continua publico
- para proteger producao de forma nativa, normalmente voce vai precisar de recurso pago

Se quiser privacidade real no dominio final, a melhor proxima etapa e login Google.

## O que conferir no GitHub

Na raiz do repositorio, confira se existem:

- `package.json`
- `vercel.json`
- `index.html`
- `styles.css`
- `runtime-config.js`
- `README.md`
- `src/`
- `public/`
- `tools/`

## O que conferir na Vercel

No projeto publicado, confira:

- build concluida com sucesso
- output `dist`
- dominio `vercel.app` funcionando
- pagina inicial abrindo sem erro
