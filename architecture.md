# Arquitetura do Life OS Thz 2026

## 1. Visao geral

O app foi reorganizado como um workspace unico com separacao clara entre:

1. `Dashboard`
   Visao geral, resultado, radar e carga.
2. `Hoje`
   Execucao enxuta e foco imediato.
3. `Dias`
   Capacidade real da semana por dia e por periodo.
4. `Entrada`
   Captura rapida no estilo inbox.
5. `Priorizar`
   Pipeline de decisao com GTD, Sapo e refino agil.
6. `Organizar`
   Saida simples em colunas operacionais.
7. `Areas`
   Vida organizada por frente, sem quebrar o banco de dados unico.
8. `Projetos`
   Organizacao dos projetos da area Trabalho.
9. `Rotina`
   Habitos, checklists, treino e energia.
10. `Planejamento`
    Sprint, objetivos, backlog e modelos.
11. `Agenda`
    Calendario interno e espaco para Google Calendar.
12. `Configuracoes`
    Linha de raciocinio, layout e parametros.

## 2. Banco unico, visoes diferentes

Vida pessoal e trabalho continuam no mesmo estado local. O sistema nao separa a vida em apps diferentes; ele cria visualizacoes diferentes sobre o mesmo conjunto de entidades.

Entidades principais:

- `areas`
- `projects`
- `objectives`
- `sprints`
- `tasks`
- `habits`
- `routines`
- `blocks`
- `dayTypes`
- `dayOverrides`
- `settings`
- `history`

## 3. Dias e capacidade

A capacidade deixou de ser apenas por dia inteiro e passou a considerar:

- tipo do dia
- periodo do dia (`manha`, `tarde`, `noite`)
- energia semanal
- carga ja alocada
- contexto da tarefa

Tipos principais implementados:

- `Normal`
- `Futebol`
- `Viagem curta`
- `Dia com reuniao`
- `Dia externo`
- `Sabado`
- `Domingo`

Cada override pode editar o dia inteiro e tambem sobrescrever o tipo de cada periodo.

## 4. Priorizacao em etapas

A priorizacao agora segue uma pipeline clara:

1. `Entrada`
   Tudo entra rapido e sem friccao.
2. `GTD`
   A tarefa e processada em `Executar`, `Agendar`, `Delegar`, `Aguardar`, `Backlog`, `Projeto` ou `Descartar`.
3. `Engolindo o Sapo`
   O sistema destaca o sapo do dia e da semana.
4. `Metodos ageis`
   Impacto, urgencia, esforco, tipo de dia, periodo e carga refinam a ordem.
5. `Organizar`
   A saida operacional fica simples.

## 5. Linha de raciocinio

A `Linha de raciocinio` virou parte do estado do sistema.
Ela influencia heuristicas do motor, como:

- proteger saude
- proteger familia
- proteger mudanca
- priorizar futuro e renda
- reduzir backlog inutil
- evitar sobrecarga artificial
- sugerir delegacao

Ou seja: nao e uma caixa preta; e uma camada explicita e editavel de decisao.

## 6. Modo edicao e layout

`Dashboard` e `Hoje` passaram a ter layout persistente por cards.
Quando o `modo edicao` esta ligado:

- cards ficam arrastaveis
- a nova ordem fica salva no estado
- o layout atual pode virar o novo padrao
- o padrao salvo pode ser restaurado depois

## 7. Replanejamento automatico

Quando um dia muda ou a semana e replanejada:

- o sistema tenta manter o que cabe no periodo
- tarefas criticas viram alerta
- tarefas grandes ou delegaveis podem ir para revisao
- o restante tenta ser movido para o proximo encaixe util

## 8. Arquitetura tecnica

- [src/app.js](../src/app.js)
  Renderizacao, navegacao, formularios, overlay critico e modo edicao.
- [src/utils/engine.js](../src/utils/engine.js)
  Heuristicas, score, GTD, Sapo, tipos de dia, reorganizacao e montagem do modelo.
- [src/data/seed.js](../src/data/seed.js)
  Seed inicial da rotina, areas, projetos, objetivos e linha de raciocinio.
- [src/services/storage.js](../src/services/storage.js)
  Persistencia local via `IndexedDB`.
- [src/services/google-calendar.js](../src/services/google-calendar.js)
  Integracao preparada com `OAuth` e leitura do calendario.

## 9. Preparacao futura

A estrutura ja foi preparada para, no futuro:

- separar o modulo de trabalho por API ou modulo externo
- manter vida e trabalho no mesmo workspace atual
- sofisticar o motor com historico de uso e recomendacao mais inteligente
- aprofundar a integracao com Google Calendar
