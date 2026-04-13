# Ambiente e Execução

## Stack detectada

- Frontend: HTML5, CSS3 e JavaScript ES Modules
- Persistência: IndexedDB com fallback para localStorage
- Servidor local para desenvolvimento e testes: Node.js puro
- Build: cópia estática para `dist/`
- Testes automatizados: Playwright
- Lint: ESLint

## Runtimes necessários

### Obrigatório

- Node.js 24 LTS recomendado
- npm 11 ou compatível

### Não usado

- Python: não faz parte da stack final

### Opcional

- Git: útil para versionamento, mas não é exigido pela execução local

## Navegadores para teste

### Preferencial

- Microsoft Edge estável no Windows, usado por padrão no Playwright nesta configuração

### Alternativa

- Chromium instalado pelo Playwright com `npm run install:browsers`
- Google Chrome, se você ajustar o canal do Playwright

## Scripts disponíveis

- `npm install`
- `npm run setup`
- `npm run check:env`
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run validate`
- `npm run test:smoke`
- `npm run test:browser`
- `npm test`
- `npm run test:diagnose`

## Ordem de uso recomendada

1. `npm install`
2. `npm run dev`
3. Abrir `http://127.0.0.1:4173`
4. `npm test`
5. `npm run build`
6. `npm run preview`

## Compatibilidade com Windows

- Os comandos principais foram padronizados para `npm` em terminal Windows normal.
- O servidor local usa `Node.js` puro, sem depender de Bash, Python ou ferramentas Unix.
- O Playwright está configurado para usar Edge no Windows por padrão, reduzindo downloads extras.
- Os wrappers PowerShell continuam no projeto como apoio opcional para automação, mas não são o caminho principal de uso.
