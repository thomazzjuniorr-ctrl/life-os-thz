# Como conectar o Google Calendar

## O que a V1 já deixa pronto

- formulário para salvar `Client ID`, `API Key` e `Calendar ID`;
- serviço separado para OAuth e leitura de eventos;
- suporte planejado para leitura de blocos ocupados e sugestão de encaixe.

## Passo a passo

1. Acesse o Google Cloud Console.
2. Crie um projeto novo para o Life OS Thz 2026.
3. Ative a Google Calendar API.
4. Configure a tela de consentimento OAuth.
5. Crie uma credencial do tipo `OAuth Client ID` para aplicação web.
6. Crie também uma `API Key`.
7. Em `Authorized JavaScript origins`, adicione a origem local que você vai usar.

Exemplos comuns:

- `http://localhost:5500`
- `http://127.0.0.1:5500`
- a porta exata do seu Live Server

## O que preencher no app

Na tela Agenda:

- `Client ID`: o OAuth Client ID da aplicação web
- `API Key`: a chave pública usada para inicializar a API
- `Calendar ID`: normalmente `primary`, ou o ID de um calendário específico

## Como conectar

1. Rode o app por um servidor local, não por `file://`.
2. Abra a tela Agenda.
3. Salve `Client ID`, `API Key` e `Calendar ID`.
4. Clique em `Conectar Google`.
5. Autorize o acesso de leitura ao calendário.
6. Clique em `Sincronizar blocos`.

## Escopo usado

O app está preparado para usar leitura do calendário:

- `https://www.googleapis.com/auth/calendar.readonly`

## Observações importantes

- Se der erro de origem não autorizada, revise os `Authorized JavaScript origins`.
- Se o popup de autenticação não abrir, confira se o navegador bloqueou popups.
- A integração da V1 foi preparada para leitura de agenda e blocos ocupados, não para escrever eventos automaticamente.
- Para uso em produção com múltiplos dispositivos, a próxima etapa recomendada é mover o OAuth para uma camada backend segura.
