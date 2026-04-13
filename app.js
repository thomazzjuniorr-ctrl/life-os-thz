import { buildSeedState } from "./data/seed.js";
import { GoogleCalendarService } from "./services/google-calendar.js";
import { loadAppState, resetAppState, saveAppState } from "./services/storage.js";
import {
  addInboxTask,
  applyGoogleBusyBlocks,
  applyTaskAction,
  buildAppModel,
  clearFilters,
  closeEditor,
  deleteEntity,
  duplicateEntity,
  moveLayoutCard,
  openEditor,
  replanWeek,
  resizeLayoutCard,
  restoreLayoutDefault,
  saveCurrentLayoutAsDefault,
  saveEntity,
  saveGoogleCalendarConfig,
  saveSettings,
  setActiveSection,
  setCalendarConnected,
  setDayPeriodType,
  setDayType,
  setFilter,
  setPriorityMethod,
  setSelectedDate,
  setWeeklyEnergy,
  toggleEditMode,
  toggleHabitForDate,
} from "./utils/engine.js";
import { formatISODate, formatShortDate } from "./utils/date.js";

const APP_VERSION = 4;
const MOBILE_BREAKPOINT = 900;

const SECTION_GROUPS = [
  {
    label: "Visao",
    items: [
      { id: "dashboard", label: "Dashboard" },
      { id: "today", label: "Hoje" },
      { id: "days", label: "Dias" },
      { id: "agenda", label: "Agenda" },
    ],
  },
  {
    label: "Decidir",
    items: [
      { id: "inbox", label: "Entrada" },
      { id: "prioritize", label: "Priorizar" },
      { id: "organize", label: "Organizar" },
    ],
  },
  {
    label: "Estrutura",
    items: [
      { id: "areas", label: "Areas" },
      { id: "projects", label: "Projetos" },
      { id: "routine", label: "Rotina" },
      { id: "planning", label: "Planejamento" },
      { id: "settings", label: "Configuracoes" },
    ],
  },
];

const PAGE_META = {
  dashboard: { kicker: "Controle", title: "Dashboard", text: "Visao geral, resultados, gargalos e carga semanal." },
  today: { kicker: "Execucao", title: "Hoje", text: "Poucas coisas, muita clareza e zero ruido desnecessario." },
  days: { kicker: "Capacidade", title: "Dias", text: "Semana editavel por dia e por periodo." },
  inbox: { kicker: "Captura", title: "Entrada", text: "Caixa de entrada rapida para tudo que surgir no dia." },
  prioritize: { kicker: "Decisao", title: "Priorizar", text: "GTD, Sapo e refino agil explicados visualmente." },
  organize: { kicker: "Saida", title: "Organizar", text: "Complexo por tras, simples na frente." },
  areas: { kicker: "Mapa", title: "Areas", text: "Uma vida so, separada por frentes e nao por sistemas diferentes." },
  projects: { kicker: "Trabalho", title: "Projetos", text: "Cada projeto com sua leitura, dentro do mesmo banco unico." },
  routine: { kicker: "Apoio", title: "Rotina", text: "Checklists, habitos, treino e energia semanal." },
  planning: { kicker: "Estrutura", title: "Planejamento", text: "Sprint, objetivos, backlog e modelos." },
  agenda: { kicker: "Tempo", title: "Agenda", text: "Calendario interno estilo workspace com suporte futuro ao Google." },
  settings: { kicker: "Sistema", title: "Configuracoes", text: "Linha de raciocinio, modo edicao, layout e parametros." },
};

const LAYOUT_WIDTH_LABELS = {
  compact: "Estreito",
  medium: "Medio",
  full: "Largo",
};

const LAYOUT_HEIGHT_LABELS = {
  compact: "Baixo",
  regular: "Medio",
  tall: "Alto",
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function truncateText(value = "", limit = 180) {
  const text = String(value).trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}...`;
}

function badge(label, tone = "") {
  return `<span class="badge ${tone}">${escapeHtml(label)}</span>`;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function metaPills(values) {
  return values.filter(Boolean).map((value) => `<span class="meta-pill">${escapeHtml(value)}</span>`).join("");
}

function metricCard(label, value, foot) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(foot)}</p>
    </article>
  `;
}

function progressBar(value) {
  return `
    <div class="progress-bar">
      <div class="progress-fill" style="width:${Math.max(0, Math.min(100, value))}%"></div>
    </div>
  `;
}

function taskActions(task, mode = "default") {
  const buttons = [];

  if (!task.isTemplate && task.status !== "done") {
    if (mode === "alert") {
      buttons.push(`<button class="tiny-button" data-task-action="resolve-now" data-task-id="${task.id}">Resolver agora</button>`);
      buttons.push(`<button class="tiny-button ghost" data-task-action="auto-defer" data-task-id="${task.id}">Adiar</button>`);
      buttons.push(`<button class="tiny-button ghost" data-task-action="delegate" data-task-id="${task.id}">Delegar</button>`);
      buttons.push(`<button class="tiny-button ghost" data-task-action="accept-risk" data-task-id="${task.id}">Ignorar com risco</button>`);
    } else if (mode === "mobile-prioritize") {
      buttons.push(`<button class="tiny-button" data-action="open-editor" data-kind="task" data-id="${task.id}">Editar</button>`);
      buttons.push(`<button class="tiny-button ghost" data-task-action="today" data-task-id="${task.id}">Hoje</button>`);
      buttons.push(`<button class="tiny-button ghost" data-task-action="auto-defer" data-task-id="${task.id}">Agendar</button>`);
    } else {
      buttons.push(`<button class="tiny-button" data-task-action="today" data-task-id="${task.id}">Hoje</button>`);
      buttons.push(`<button class="tiny-button ghost" data-task-action="complete" data-task-id="${task.id}">Concluir</button>`);
      buttons.push(`<button class="tiny-button ghost" data-task-action="auto-defer" data-task-id="${task.id}">Mover</button>`);
    }

    if (task.delegable) {
      buttons.push(`<button class="tiny-button ghost" data-task-action="delegate" data-task-id="${task.id}">Delegar</button>`);
    }
  }

  if (task.isTemplate) {
    buttons.push(`<button class="tiny-button" data-task-action="instantiate-template" data-task-id="${task.id}">Usar modelo</button>`);
  }

  buttons.push(`<button class="tiny-button ghost" data-task-action="mark-frog-day" data-task-id="${task.id}">Sapo</button>`);
  if (mode !== "mobile-prioritize") {
    buttons.push(`<button class="tiny-button ghost" data-action="open-editor" data-kind="task" data-id="${task.id}">Editar</button>`);
  }
  return `<div class="task-actions">${buttons.join("")}</div>`;
}

function taskCard(task, options = {}) {
  const headerPills = metaPills([
    task.areaName,
    task.projectName || "",
    task.periodLabel,
    task.dayTypeLabel,
  ]);
  const reasonLine = task.reasons?.length ? `<p class="reason-line">${escapeHtml(task.reasons.join(" | "))}</p>` : "";
  const subtaskList = task.subtasks?.length
    ? `<ul class="mini-list">${task.subtasks.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  return `
    <article class="task-card ${options.emphasis ? "emphasis" : ""}">
      <div class="task-card-top">
        <div>
          <div class="meta-row">${headerPills}</div>
          <h4>${escapeHtml(task.title)}</h4>
          <p>${escapeHtml(task.gtdDecision)}${task.frogLabel ? ` • ${escapeHtml(task.frogLabel)}` : ""}</p>
        </div>
        ${badge(`Score ${Math.round(task.score)}`, task.critical ? "danger" : "")}
      </div>
      ${task.nextAction ? `<p class="next-action"><strong>Proxima acao:</strong> ${escapeHtml(task.nextAction)}</p>` : ""}
      ${subtaskList}
      ${reasonLine}
      ${task.suggestions?.length ? `<div class="meta-row">${metaPills(task.suggestions)}</div>` : ""}
      ${task.notes ? `<p class="muted-copy">${escapeHtml(task.notes)}</p>` : ""}
      ${taskActions(task, options.mode)}
    </article>
  `;
}

function taskList(tasks, options = {}) {
  if (!tasks?.length) {
    return emptyState(options.empty || "Nada por aqui.");
  }

  return `<div class="stack-list">${tasks.map((task) => taskCard(task, options)).join("")}</div>`;
}

function panel(title, body, options = {}) {
  return `
    <section class="panel-card ${options.wide ? "wide" : ""}">
      <div class="panel-head">
        <div>
          <h3>${escapeHtml(title)}</h3>
          ${options.subtitle ? `<p>${escapeHtml(options.subtitle)}</p>` : ""}
        </div>
        ${options.badge ? badge(options.badge, options.badgeTone || "") : ""}
      </div>
      ${body}
    </section>
  `;
}

function getLayoutItem(model, page, cardId, options = {}) {
  const fallbackWidth = options.wide ? "full" : "medium";
  return model.settings.layouts[page]?.find((entry) => entry.id === cardId) || {
    id: cardId,
    width: fallbackWidth,
    height: "regular",
    frame: null,
  };
}

function layoutCard(page, cardId, title, body, model, options = {}) {
  const layoutItem = getLayoutItem(model, page, cardId, options);
  const widthClass = `layout-width-${layoutItem.width}`;
  const heightClass = `layout-height-${layoutItem.height}`;
  const editTools = model.editMode
    ? `
      <div class="layout-edit-bar">
        <div class="layout-handle">Arraste para reorganizar</div>
        <div class="layout-edit-actions">
          <button class="ghost-button small" data-action="resize-layout-card" data-layout-page="${page}" data-layout-card="${cardId}" data-layout-dimension="width" data-layout-direction="decrease" aria-label="Diminuir largura ${escapeHtml(title)}">- largura</button>
          <button class="ghost-button small" data-action="resize-layout-card" data-layout-page="${page}" data-layout-card="${cardId}" data-layout-dimension="width" data-layout-direction="increase" aria-label="Aumentar largura ${escapeHtml(title)}">+ largura</button>
          <button class="ghost-button small" data-action="resize-layout-card" data-layout-page="${page}" data-layout-card="${cardId}" data-layout-dimension="height" data-layout-direction="decrease" aria-label="Diminuir altura ${escapeHtml(title)}">- altura</button>
          <button class="ghost-button small" data-action="resize-layout-card" data-layout-page="${page}" data-layout-card="${cardId}" data-layout-dimension="height" data-layout-direction="increase" aria-label="Aumentar altura ${escapeHtml(title)}">+ altura</button>
          <span class="layout-size-pill">${escapeHtml(LAYOUT_WIDTH_LABELS[layoutItem.width] || layoutItem.width)} • ${escapeHtml(LAYOUT_HEIGHT_LABELS[layoutItem.height] || layoutItem.height)}</span>
        </div>
      </div>
    `
    : "";

  return `
    <div
      class="layout-card ${model.editMode ? "editable" : ""} ${widthClass} ${heightClass}"
      ${model.editMode ? 'draggable="true"' : ""}
      data-layout-page="${page}"
      data-layout-card="${cardId}"
    >
      ${editTools}
      ${panel(title, body, { ...options, wide: false })}
    </div>
  `;
}

function renderMobileTopbar(model, options = {}) {
  const page = PAGE_META[model.activeSection] || PAGE_META.today;
  return `
    <section class="mobile-topbar-card">
      <div class="mobile-topbar-row">
        <button
          class="ghost-button small icon-button"
          data-action="${options.navOpen ? "close-mobile-nav" : "toggle-mobile-nav"}"
          aria-label="${options.navOpen ? "Fechar menu" : "Abrir menu"}"
        >
          ${options.navOpen ? "Fechar" : "Menu"}
        </button>
        <div class="mobile-topbar-copy">
          <span class="page-kicker">${escapeHtml(page.kicker)}</span>
          <strong>${escapeHtml(page.title)}</strong>
        </div>
        <button class="ghost-button small" data-action="navigate" data-section="inbox">Entrada</button>
      </div>
    </section>
  `;
}

function renderSidebar(model, options = {}) {
  const mobileClass = options.isMobile ? "mobile-drawer" : "";
  const openClass = options.isMobile && options.navOpen ? "open" : "";
  return `
    <aside class="workspace-sidebar ${mobileClass} ${openClass}" ${options.isMobile ? `aria-hidden="${options.navOpen ? "false" : "true"}"` : ""}>
      ${options.isMobile ? `
        <div class="mobile-sidebar-head">
          <span class="page-kicker">Navegacao</span>
          <button class="ghost-button small" data-action="close-mobile-nav">Fechar</button>
        </div>
      ` : ""}
      <div class="brand-block">
        <span class="brand-kicker">Life OS Thz 2026</span>
        <h1>Workspace de vida e trabalho</h1>
        <p>Um sistema unico para decidir, executar e reorganizar a semana real.</p>
      </div>
      ${SECTION_GROUPS.map((group) => `
        <div class="nav-group">
          <h2>${escapeHtml(group.label)}</h2>
          ${group.items.map((item) => `
            <button class="nav-button ${model.activeSection === item.id ? "active" : ""}" data-action="navigate" data-section="${item.id}">
              ${escapeHtml(item.label)}
            </button>
          `).join("")}
        </div>
      `).join("")}
      <div class="sidebar-footer">
        <button class="ghost-button full" data-action="toggle-edit-mode">${model.editMode ? "Sair do modo edicao" : "Entrar no modo edicao"}</button>
        <button class="ghost-button full" data-action="reset-app">Resetar base local</button>
      </div>
    </aside>
  `;
}

function renderWeekRail(model, options = {}) {
  return `
    <section class="week-rail ${options.isMobile ? "mobile-rail" : ""}">
      ${model.week.days.map((day) => `
        <article class="day-chip ${day.date === model.selectedDate ? "selected" : ""}">
          <button class="day-chip-hit" data-action="select-day" data-date="${day.date}">
            <strong>${escapeHtml(day.weekdayLabel.slice(0, 3))}</strong>
            <span>${escapeHtml(day.shortLabel)}</span>
            <small>${escapeHtml(day.type.label)}</small>
            <small>${day.totalLoad}/${day.totalCapacity} min</small>
            <small>${day.alerts} alerta(s)</small>
          </button>
          ${day.date === model.selectedDate ? `
            <select class="inline-select" data-day-type-date="${day.date}">
              ${model.options.dayTypes.map((type) => `<option value="${type.id}" ${day.type.id === type.id ? "selected" : ""}>${escapeHtml(type.label)}</option>`).join("")}
            </select>
          ` : ""}
        </article>
      `).join("")}
    </section>
  `;
}

function renderScopeFilters(model) {
  return `
    <div class="filters-row">
      ${model.options.scopes.map((scope) => `
        <button class="chip-button ${model.filters.scope === scope.id ? "active" : ""}" data-action="set-filter" data-filter-name="scope" data-filter-value="${scope.id}">${escapeHtml(scope.label)}</button>
      `).join("")}
    </div>
  `;
}

function renderFilterGrid(model) {
  return `
    <div class="filter-grid">
      <label class="field compact"><span>Area</span><select data-filter="areaId"><option value="all">Todas</option>${model.options.areas.map((area) => `<option value="${area.id}" ${model.filters.areaId === area.id ? "selected" : ""}>${escapeHtml(area.name)}</option>`).join("")}</select></label>
      <label class="field compact"><span>Projeto</span><select data-filter="projectId"><option value="all">Todos</option>${model.options.projects.map((project) => `<option value="${project.id}" ${model.filters.projectId === project.id ? "selected" : ""}>${escapeHtml(project.name)}</option>`).join("")}</select></label>
      <label class="field compact"><span>Contexto</span><select data-filter="context"><option value="all">Todos</option>${model.options.contexts.map((context) => `<option value="${context}" ${model.filters.context === context ? "selected" : ""}>${escapeHtml(context)}</option>`).join("")}</select></label>
      <label class="field compact"><span>Tipo do dia</span><select data-filter="dayTypeId"><option value="all">Todos</option>${model.options.dayTypes.map((type) => `<option value="${type.id}" ${model.filters.dayTypeId === type.id ? "selected" : ""}>${escapeHtml(type.label)}</option>`).join("")}</select></label>
    </div>
  `;
}

function renderHeaderToolbar(model, options = {}) {
  return `
    <div class="toolbar-row ${options.subtle ? "subtle-toolbar" : ""}">
      <button class="ghost-button" data-action="clear-filters">Limpar filtros</button>
      <button class="secondary-button" data-action="replan-week">Reorganizar semana</button>
      <button class="primary-button" data-action="navigate" data-section="inbox">${options.mobileCopy ? "Nova captura" : "Nova captura"}</button>
    </div>
  `;
}

function renderHeader(model, options = {}) {
  const page = PAGE_META[model.activeSection] || PAGE_META.today;
  if (options.isMobile) {
    return `
      <section class="workspace-header-card mobile-header-card">
        <div class="header-main-row">
          <div>
            <span class="page-kicker">${escapeHtml(page.kicker)}</span>
            <h2>${escapeHtml(page.title)}</h2>
            <p>${escapeHtml(page.text)}</p>
          </div>
          <div class="header-badges mobile-header-badges">
            ${badge(`Energia ${model.dashboard.energyLabel}`)}
            ${model.selectedDay.alerts ? badge(`${model.selectedDay.alerts} alerta(s)`, "warning") : badge("Sem alertas", "success")}
          </div>
        </div>
        ${renderWeekRail(model, options)}
        <div class="mobile-header-summary">
          <span>${escapeHtml(model.selectedDay.type.label)}</span>
          <span>${model.selectedDay.totalLoad}/${model.selectedDay.totalCapacity} min</span>
          <span>${escapeHtml(model.selectedDay.longLabel)}</span>
        </div>
        <div class="toolbar-row mobile-quick-actions">
          <button class="secondary-button" data-action="replan-week">Reorganizar</button>
          <button class="ghost-button" data-action="navigate" data-section="prioritize">Priorizar</button>
        </div>
      </section>
    `;
  }

  return `
    <section class="workspace-context-stack">
      <article class="workspace-page-card">
        <div class="header-main-row">
          <div>
            <span class="page-kicker">${escapeHtml(page.kicker)}</span>
            <h2>${escapeHtml(page.title)}</h2>
            <p>${escapeHtml(page.text)}</p>
          </div>
          <div class="header-badges">
            ${badge(`Energia ${model.dashboard.energyLabel}`)}
            ${badge(`Metodo ${model.options.methods.find((item) => item.id === model.priorityMethod)?.label || model.priorityMethod}`)}
          </div>
        </div>
      </article>
      <article class="workspace-week-card">
        <div class="panel-head">
          <div>
            <span class="page-kicker">Semana ativa</span>
            <h3>${escapeHtml(model.selectedDay.longLabel)}</h3>
            <p>${escapeHtml(model.selectedDay.type.label)} • ${model.selectedDay.totalLoad}/${model.selectedDay.totalCapacity} min • ${model.selectedDay.alerts} alerta(s)</p>
          </div>
          <div class="meta-row">
            ${metaPills([
              model.dashboard.currentSprint ? `Sprint: ${model.dashboard.currentSprint.title}` : "Sem sprint ativo",
              `${model.dashboard.weekProgress.percent}% da semana concluida`,
              `${model.dashboard.daysToMove} dias para mudanca`,
            ])}
          </div>
        </div>
        ${renderWeekRail(model, options)}
      </article>
      <article class="workspace-controls-card">
        ${renderScopeFilters(model)}
        ${renderFilterGrid(model)}
        ${renderHeaderToolbar(model, { subtle: true })}
      </article>
    </section>
  `;
}

function renderDashboardPage(model) {
  const cards = {
    overview: layoutCard("dashboard", "overview", "Panorama da semana", `
      <div class="metric-grid four">
        ${metricCard("Sprint", model.dashboard.currentSprint ? `${model.dashboard.currentSprint.progress}%` : "Sem sprint", model.dashboard.currentSprint?.title || "Sem dado")}
        ${metricCard("Semana", `${model.dashboard.weekProgress.percent}%`, `${model.dashboard.weekProgress.done}/${model.dashboard.weekProgress.total} concluidas`) }
        ${metricCard("Energia", model.dashboard.energyLabel, "Usada para capacidade real")}
        ${metricCard("Dias para mudanca", String(model.dashboard.daysToMove), "Meta ate novembro")}
      </div>
    `, model),
    radar: layoutCard("dashboard", "radar", "Radar da semana", `
      <div class="stack-list">
        ${(model.dashboard.alerts.length ? model.dashboard.alerts : [{ title: "Semana sob controle", gtdDecision: "OK", areaName: "Sistema", score: 0, reasons: ["sem gargalos criticos"], suggestions: [], subtasks: [] }]).map((task) => task.id ? taskCard(task, { mode: "alert" }) : `<div class="callout success"><strong>${escapeHtml(task.title)}</strong><p>${escapeHtml(task.reasons[0])}</p></div>`).join("")}
      </div>
    `, model),
    goals: layoutCard("dashboard", "goals", "Metas principais", `
      <div class="stack-list compact-stack">
        ${model.dashboard.mainGoals.map((goal) => `
          <div class="goal-row">
            <div><strong>${escapeHtml(goal.title)}</strong><p>${escapeHtml(goal.description)}</p></div>
            <div class="goal-meter">${progressBar(goal.progress)}<span>${goal.progress}%</span></div>
          </div>
        `).join("")}
      </div>
    `, model),
    areas: layoutCard("dashboard", "areas", "Resumo das areas", `
      <div class="stack-list compact-stack">
        ${model.dashboard.areaSummaries.map((area) => `
          <article class="summary-row">
            <div><strong>${escapeHtml(area.name)}</strong><p>${escapeHtml(area.description)}</p></div>
            <div class="meta-row">${metaPills([`${area.openCount} abertas`, `${area.priorityCount} fortes`, `${area.alerts} alertas`])}</div>
          </article>
        `).join("")}
      </div>
    `, model),
    projects: layoutCard("dashboard", "projects", "Resumo dos projetos", `
      <div class="stack-list compact-stack">
        ${model.dashboard.projectSummaries.map((project) => `
          <article class="summary-row">
            <div><strong>${escapeHtml(project.name)}</strong><p>${escapeHtml(project.summary)}</p></div>
            <div class="meta-row">${metaPills([`${project.openCount} abertas`, `${project.progress}% previsivel`])}</div>
          </article>
        `).join("")}
      </div>
    `, model),
    load: layoutCard("dashboard", "load", "Carga semanal", `
      <div class="week-load-grid">
        ${model.dashboard.load.days.map((day) => `
          <article class="load-cell ${day.overload ? "overload" : ""}">
            <strong>${escapeHtml(day.weekdayLabel.slice(0, 3))}</strong>
            <span>${escapeHtml(day.type.label)}</span>
            <small>${day.totalLoad}/${day.totalCapacity} min</small>
          </article>
        `).join("")}
      </div>
    `, model),
  };

  return `<section class="layout-grid">${model.settings.layouts.dashboard.map((entry) => cards[entry.id]).filter(Boolean).join("")}</section>`;
}

function renderTodayPage(model, options = {}) {
  const topPriorities = model.selectedDay.tasks.slice(0, 3);
  const queue = model.selectedDay.tasks.slice(3, options.isMobile ? 8 : 10);
  const alertTasks = model.selectedDay.tasks.filter((task) => task.manualDecision || task.location === "alert");
  const cards = {
    focus: layoutCard("today", "focus", "3 prioridades do dia", taskList(topPriorities, { emphasis: true, empty: "O dia esta leve. Use para recuperar energia ou simplificar backlog." }), model, { wide: true }),
    queue: layoutCard("today", "queue", "Fila do dia", taskList(queue, { empty: "Sem fila pendente para hoje." }), model),
    calendar: layoutCard("today", "calendar", "Mini calendario do dia", model.selectedDay.timeline.length ? `<div class="timeline-list">${model.selectedDay.timeline.map((entry) => `<div class="timeline-item ${entry.source}"><span>${escapeHtml(entry.startTime)} - ${escapeHtml(entry.endTime)}</span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.source === "task" ? "tarefa" : entry.source)}</small></div>`).join("")}</div>` : emptyState("Nada alocado visualmente neste dia."), model),
    alerts: layoutCard("today", "alerts", "Tipo de dia, carga e alertas", `
      <div class="stack-list compact-stack">
        <div class="callout ${model.selectedDay.lowCapacity ? "warning" : "success"}">
          <strong>${escapeHtml(model.selectedDay.type.label)}</strong>
          <p>${escapeHtml(model.selectedDay.type.explanation)} ${model.selectedDay.totalLoad}/${model.selectedDay.totalCapacity} min previstos.</p>
        </div>
        <div class="period-grid">
          ${model.selectedDay.periods.map((period) => `
            <article class="mini-period ${period.overload ? "overload" : ""}">
              <strong>${escapeHtml(period.label)}</strong>
              <span>${escapeHtml(period.type.label)}</span>
              <small>${period.load}/${period.capacity} min</small>
            </article>
          `).join("")}
        </div>
        ${taskList(alertTasks, { empty: "Nenhuma decisao manual pendente.", mode: "alert" })}
      </div>
    `, model),
  };

  const mobileAlertStrip = options.isMobile
    ? `
      <section class="mobile-alert-strip">
        ${alertTasks.length
          ? alertTasks.slice(0, 2).map((task) => `
              <article class="callout warning">
                <strong>${escapeHtml(task.title)}</strong>
                <p>${escapeHtml(task.reasons?.[0] || "Precisa de decisao manual.")}</p>
                <div class="task-actions compact-actions">
                  <button class="tiny-button" data-task-action="resolve-now" data-task-id="${task.id}">Resolver</button>
                  <button class="tiny-button ghost" data-task-action="auto-defer" data-task-id="${task.id}">Adiar</button>
                  <button class="tiny-button ghost" data-action="open-editor" data-kind="task" data-id="${task.id}">Editar</button>
                </div>
              </article>
            `).join("")
          : `<article class="callout success"><strong>Dia limpo</strong><p>Sem alertas manuais pendentes.</p></article>`}
      </section>
    `
    : "";

  return `
    <section class="today-hero">
      <div>
        <span class="page-kicker">${escapeHtml(model.selectedDay.type.label)}</span>
        <h3>${escapeHtml(topPriorities[0]?.title || model.dashboard.currentSprint?.title || "Dia organizado para caber na sua rotina real")}</h3>
        <p>${escapeHtml(model.selectedDay.longLabel)} • ${model.selectedDay.totalLoad}/${model.selectedDay.totalCapacity} min • ${model.selectedDay.alerts} alerta(s)</p>
      </div>
      <div class="toolbar-row">
        <button class="secondary-button" data-action="navigate" data-section="prioritize">Abrir priorizacao</button>
        <button class="ghost-button" data-action="navigate" data-section="inbox">Capturar algo novo</button>
      </div>
    </section>
    ${mobileAlertStrip}
    <section class="layout-grid">${model.settings.layouts.today.map((entry) => cards[entry.id]).filter(Boolean).join("")}</section>
  `;
}

function renderDaysPage(model) {
  return `
    <section class="page-grid two">
      ${panel("Leitura do dia", `
        <div class="callout ${model.selectedDay.lowCapacity ? "warning" : ""}">
          <strong>${escapeHtml(model.selectedDay.type.label)}</strong>
          <p>${escapeHtml(model.selectedDay.type.explanation)} ${model.selectedDay.totalLoad}/${model.selectedDay.totalCapacity} min usados.</p>
        </div>
        <div class="period-editor-grid">
          ${model.selectedDay.periods.map((period) => `
            <article class="period-card ${period.overload ? "overload" : ""}">
              <div class="period-head"><strong>${escapeHtml(period.label)}</strong><span>${period.load}/${period.capacity} min</span></div>
              <select data-period-type-date="${model.selectedDay.date}" data-period-id="${period.id}">
                ${model.options.dayTypes.map((type) => `<option value="${type.id}" ${period.type.id === type.id ? "selected" : ""}>${escapeHtml(type.label)}</option>`).join("")}
              </select>
              ${taskList(period.tasks, { empty: "Sem tarefas neste periodo." })}
            </article>
          `).join("")}
        </div>
      `, { badge: model.selectedDay.lowCapacity ? "Capacidade baixa" : "Capacidade ok", badgeTone: model.selectedDay.lowCapacity ? "warning" : "success" })}
      ${panel("Urgentes e alertas", taskList(model.selectedDay.tasks.filter((task) => task.critical || task.manualDecision || task.location === "alert"), { empty: "Nenhum item urgente no dia.", mode: "alert" }))}
    </section>
  `;
}
function renderInboxPage(model) {
  return `
    <section class="page-grid two">
      ${panel("Nova captura", `
        <form class="form-grid" data-form="capture-task">
          <label class="field"><span>Titulo</span><input name="title" required /></label>
          <div class="field-grid two">
            <label class="field"><span>Area</span><select name="areaId">${model.options.areas.map((area) => `<option value="${area.id}">${escapeHtml(area.name)}</option>`).join("")}</select></label>
            <label class="field"><span>Projeto</span><select name="projectId"><option value="">Sem projeto</option>${model.options.projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("")}</select></label>
          </div>
          <div class="field-grid three">
            <label class="field"><span>Prazo</span><input type="date" name="dueDate" /></label>
            <label class="field"><span>Duracao</span><input type="number" name="estimatedMinutes" min="5" value="30" /></label>
            <label class="field"><span>Contexto</span><select name="context">${model.options.contexts.map((context) => `<option value="${context}">${escapeHtml(context)}</option>`).join("")}</select></label>
          </div>
          <label class="field"><span>Observacao</span><textarea name="notes"></textarea></label>
          <button class="primary-button" type="submit">Adicionar na entrada</button>
        </form>
      `)}
      ${panel("Inbox", taskList(model.inbox, { empty: "Inbox limpa. Capture com poucas friccoes." }))}
    </section>
  `;
}

function renderPrioritizePage(model, options = {}) {
  if (options.isMobile) {
    return `
      <section class="mobile-prioritize-stack">
        ${panel("Metodo atual", `
          <div class="method-strip mobile-method-strip">${model.options.methods.map((item) => `<button class="chip-button ${model.priorityMethod === item.id ? "active" : ""}" data-action="set-priority-method" data-method="${item.id}">${escapeHtml(item.label)}</button>`).join("")}</div>
          <p class="muted-copy">${escapeHtml(model.options.methods.find((item) => item.id === model.priorityMethod)?.guide || "")}</p>
          <div class="mobile-stage-summary">
            ${model.prioritize.stages.map((stage) => `<article class="stage-summary-card"><strong>${stage.count}</strong><span>${escapeHtml(stage.decision)}</span></article>`).join("")}
          </div>
        `)}
        ${panel("Sapo do dia e da semana", `
          <div class="stack-list compact-stack">
            ${model.prioritize.dayFrog ? taskCard(model.prioritize.dayFrog, { emphasis: true, mode: "mobile-prioritize" }) : emptyState("Nenhum sapo do dia definido.")}
            ${model.prioritize.weekFrog ? taskCard(model.prioritize.weekFrog, { emphasis: true, mode: "mobile-prioritize" }) : emptyState("Nenhum sapo da semana definido.")}
          </div>
        `)}
        ${panel("Fila para decidir", taskList(model.prioritize.ranked.slice(0, 6), { empty: "Nada para refinar agora.", mode: "mobile-prioritize" }))}
        ${panel("Linha de raciocinio", `
          <div class="reading-card">
            <p>${escapeHtml(truncateText(model.settings.reasoningLine, 240))}</p>
            <button class="ghost-button" data-action="navigate" data-section="settings">Editar linha de raciocinio</button>
          </div>
        `)}
      </section>
    `;
  }

  return `
    <section class="page-grid two">
      ${panel("Pipeline de priorizacao", `
        <div class="method-strip">${model.options.methods.map((item) => `<button class="chip-button ${model.priorityMethod === item.id ? "active" : ""}" data-action="set-priority-method" data-method="${item.id}">${escapeHtml(item.label)}</button>`).join("")}</div>
        <p class="muted-copy">${escapeHtml(model.options.methods.find((item) => item.id === model.priorityMethod)?.guide || "")}</p>
        <div class="stage-grid">${model.prioritize.stages.map((stage) => `<article class="stage-card"><strong>${escapeHtml(stage.decision)}</strong><span>${stage.count} tarefa(s)</span><div class="stage-mini-list">${stage.tasks.slice(0, 3).map((task) => `<small>${escapeHtml(task.title)}</small>`).join("") || "<small>Sem itens</small>"}</div></article>`).join("")}</div>
      `, { wide: true })}
      ${panel("Sapo do dia e da semana", `<div class="stack-list compact-stack">${model.prioritize.dayFrog ? taskCard(model.prioritize.dayFrog, { emphasis: true }) : emptyState("Nenhum sapo do dia definido.")}${model.prioritize.weekFrog ? taskCard(model.prioritize.weekFrog, { emphasis: true }) : emptyState("Nenhum sapo da semana definido.")}</div>`)}
      ${panel("Refino final", taskList(model.prioritize.ranked, { empty: "Nada para refinar agora." }), { wide: true })}
      ${panel("Linha de raciocinio", `<div class="reading-card"><p>${escapeHtml(model.settings.reasoningLine)}</p><button class="ghost-button" data-action="navigate" data-section="settings">Editar linha de raciocinio</button></div>`)}
    </section>
  `;
}

function renderOrganizePage(model, options = {}) {
  if (options.isMobile) {
    return `
      <section class="organize-mobile-stack">
        ${model.organize.map((bucket) => panel(bucket.label, taskList(bucket.tasks, { empty: "Sem tarefas nesta secao.", mode: "mobile-prioritize" }), { badge: `${bucket.tasks.length}` }))}
      </section>
    `;
  }

  return `<section class="organize-board">${model.organize.map((bucket) => `<article class="board-column"><div class="panel-head"><h3>${escapeHtml(bucket.label)}</h3>${badge(`${bucket.tasks.length}`)}</div>${taskList(bucket.tasks, { empty: "Sem tarefas nesta coluna." })}</article>`).join("")}</section>`;
}

function renderAreasPage(model) {
  return `<section class="page-grid two">${model.areas.map((area) => panel(area.name, `<p class="muted-copy">${escapeHtml(area.description)}</p><div class="meta-row">${metaPills([`${area.openCount} abertas`, `${area.priorityCount} em destaque`, `${area.alerts} alertas`])}</div>${taskList(area.nextTasks, { empty: "Sem tarefas abertas nesta area." })}<div class="toolbar-row"><button class="ghost-button" data-action="open-editor" data-kind="area" data-id="${area.id}">Editar area</button></div>`)).join("")}</section>`;
}

function renderProjectsPage(model) {
  return `<section class="page-grid two">${model.projects.map((project) => panel(project.name, `<p class="muted-copy">${escapeHtml(project.summary)}</p><div class="meta-row">${metaPills([`${project.openCount} abertas`, `${project.progress}% previsivel`])}</div>${taskList(project.nextTasks, { empty: "Sem tarefas abertas neste projeto." })}<div class="toolbar-row"><button class="ghost-button" data-action="open-editor" data-kind="project" data-id="${project.id}">Editar projeto</button></div>`)).join("")}</section>`;
}

function renderRoutinePage(model) {
  return `
    <section class="page-grid two">
      ${panel("Checklist da manha", `<div class="stack-list compact-stack">${model.routine.morning.map((item) => `<label class="check-row"><span>${escapeHtml(item.title)}</span><button class="ghost-button small" data-action="open-editor" data-kind="routine" data-id="${item.id}">Editar</button></label>`).join("")}</div>`)}
      ${panel("Checklist da noite", `<div class="stack-list compact-stack">${model.routine.night.map((item) => `<label class="check-row"><span>${escapeHtml(item.title)}</span><button class="ghost-button small" data-action="open-editor" data-kind="routine" data-id="${item.id}">Editar</button></label>`).join("")}</div>`)}
      ${panel("Habitos da semana", `<div class="stack-list compact-stack">${model.routine.habits.map((habit) => `<article class="habit-row"><div><strong>${escapeHtml(habit.title)}</strong><p>${habit.done}/${habit.targetPerWeek} na semana</p>${progressBar(habit.percent)}</div><button class="secondary-button" data-action="toggle-habit" data-habit-id="${habit.id}" data-date="${model.selectedDate}">Marcar hoje</button></article>`).join("")}</div>`, { wide: true })}
      ${panel("Energia da semana", `<div class="energy-strip">${[1, 2, 3, 4, 5].map((level) => `<button class="chip-button" data-action="set-energy" data-energy="${level}">${level}</button>`).join("")}</div>${taskList(model.routine.healthTasks, { empty: "Sem tarefas de saude nesta semana." })}`)}
    </section>
  `;
}

function renderPlanningPage(model) {
  return `
    <section class="page-grid two">
      ${panel("Sprint atual", model.planning.currentSprint ? `<div class="reading-card"><strong>${escapeHtml(model.planning.currentSprint.title)}</strong><p>${escapeHtml(model.planning.currentSprint.theme)}</p><div class="meta-row">${metaPills(model.planning.currentSprint.keyResults)}</div></div>` : emptyState("Sem sprint atual."), { wide: true })}
      ${panel("Objetivos", `<div class="stack-list compact-stack">${model.planning.objectives.map((objective) => `<article class="goal-row"><div><strong>${escapeHtml(objective.title)}</strong><p>${escapeHtml(objective.description)}</p></div><div class="goal-meter">${progressBar(objective.progress)}<span>${objective.progress}%</span></div></article>`).join("")}</div>`)}
      ${panel("Backlog", taskList(model.planning.backlog, { empty: "Backlog limpo." }))}
      ${panel("Modelos", taskList(model.planning.templates, { empty: "Sem modelos ainda." }))}
    </section>
  `;
}

function renderAgendaPage(model) {
  return `
    <section class="page-grid two">
      ${panel("Semana em blocos", `<div class="week-calendar-grid">${model.agenda.days.map((day) => `<article class="calendar-day-column"><div class="calendar-day-head"><strong>${escapeHtml(day.weekdayLabel.slice(0, 3))}</strong><span>${escapeHtml(day.shortLabel)}</span></div><div class="calendar-events">${day.timeline.map((entry) => `<div class="calendar-event ${entry.source}"><small>${escapeHtml(entry.startTime)} - ${escapeHtml(entry.endTime)}</small><strong>${escapeHtml(entry.title)}</strong></div>`).join("") || "<small>Dia vazio</small>"}</div></article>`).join("")}</div>`, { wide: true })}
      ${panel("Google Calendar", `<form class="form-grid" data-form="google-config"><label class="field"><span>Client ID</span><input name="clientId" value="${escapeHtml(model.agenda.google.clientId || "")}" /></label><label class="field"><span>API Key</span><input name="apiKey" value="${escapeHtml(model.agenda.google.apiKey || "")}" /></label><label class="field"><span>Calendar ID</span><input name="calendarId" value="${escapeHtml(model.agenda.google.calendarId || "primary")}" /></label><div class="toolbar-row"><button class="primary-button" type="submit">Salvar</button><button class="secondary-button" type="button" data-action="connect-google">Conectar Google</button><button class="ghost-button" type="button" data-action="sync-google">Sincronizar blocos</button></div></form><p class="muted-copy">Status: ${model.agenda.connected ? "conectado" : "nao conectado"}</p>`)}
    </section>
  `;
}

function renderSettingsPage(model) {
  return `
    <section class="page-grid two">
      ${panel("Modo edicao e layout", `<div class="callout ${model.settings.editMode ? "warning" : ""}"><strong>${model.settings.editMode ? "Modo edicao ativo" : "Modo visualizacao ativo"}</strong><p>${model.settings.editMode ? "Voce pode arrastar e redimensionar cards em um grid flexivel, sem perder a organizacao." : "Layout travado para uso diario seguro."}</p></div><div class="toolbar-row"><button class="secondary-button" data-action="toggle-edit-mode">${model.settings.editMode ? "Desligar modo edicao" : "Ligar modo edicao"}</button><button class="ghost-button" data-action="save-layout-default">Salvar layout atual</button><button class="ghost-button" data-action="restore-layout-default">Restaurar layout padrao</button></div><div class="meta-row">${metaPills([`Modo: ${model.settings.layoutMode}`, model.settings.layoutCapabilities.resizeEnabled ? "Resize ativo" : "Resize inativo", model.settings.layoutCapabilities.futureFreeformReady ? "Base pronta para layout livre" : "Grid fixo"])}</div><div class="layout-summary-grid">${renderLayoutSummary(model.settings.layouts)}</div>`, { wide: true })}
      ${panel("Configuracoes do sistema", `<form class="form-grid" data-form="settings-form"><div class="field-grid two"><label class="field"><span>Densidade visual</span><select name="visualDensity"><option value="calm" ${model.settings.visualDensity === "calm" ? "selected" : ""}>Calma</option><option value="compact" ${model.settings.visualDensity === "compact" ? "selected" : ""}>Compacta</option></select></label><label class="field"><span>Tom visual</span><select name="accentTone"><option value="sand" ${model.settings.accentTone === "sand" ? "selected" : ""}>Sand</option><option value="sage" ${model.settings.accentTone === "sage" ? "selected" : ""}>Sage</option><option value="ink" ${model.settings.accentTone === "ink" ? "selected" : ""}>Ink</option></select></label></div><div class="field-grid three"><label class="field"><span>Saude</span><input type="number" step="0.01" name="healthProtection" value="${escapeHtml(model.settings.prioritization.healthProtection)}" /></label><label class="field"><span>Mudanca</span><input type="number" step="0.01" name="moveProtection" value="${escapeHtml(model.settings.prioritization.moveProtection)}" /></label><label class="field"><span>Familia</span><input type="number" step="0.01" name="familyProtection" value="${escapeHtml(model.settings.prioritization.familyProtection)}" /></label></div><div class="field-grid three"><label class="field"><span>Futuro</span><input type="number" step="0.01" name="futureFocus" value="${escapeHtml(model.settings.prioritization.futureFocus)}" /></label><label class="field"><span>Delegacao</span><input type="number" step="0.01" name="delegationBias" value="${escapeHtml(model.settings.prioritization.delegationBias)}" /></label><label class="field"><span>Limite de carga</span><input type="number" step="0.01" name="overloadLimit" value="${escapeHtml(model.settings.prioritization.overloadLimit)}" /></label></div><label class="field"><span>Linha de raciocinio</span><textarea name="reasoningLine">${escapeHtml(model.settings.reasoningLine)}</textarea></label><button class="primary-button" type="submit">Salvar configuracoes</button></form>`)}
    </section>
  `;
}
function renderFloatingAlert(task, options = {}) {
  if (!task) return "";
  const mobileClass = options.isMobile ? " mobile" : "";
  return `<div class="floating-alert-shell${mobileClass}"><div class="floating-alert-card${mobileClass}" role="alertdialog" aria-modal="true"><span class="page-kicker">Alerta critico</span><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.areaName)}${task.projectName ? ` • ${escapeHtml(task.projectName)}` : ""}</p><p class="muted-copy">Motivo: ${escapeHtml(task.reasons.join(" | "))}</p><div class="toolbar-row"><button class="primary-button" data-task-action="resolve-now" data-task-id="${task.id}">Resolver agora</button><button class="secondary-button" data-task-action="auto-defer" data-task-id="${task.id}">Adiar</button><button class="ghost-button" data-task-action="delegate" data-task-id="${task.id}">Delegar</button><button class="ghost-button" data-task-action="accept-risk" data-task-id="${task.id}">Ignorar com risco</button></div></div></div>`;
}

function renderEditorModal(editorView, options) {
  if (!editorView) return "";
  const { kind, entity } = editorView;
  const areaOptions = options.areas.map((area) => `<option value="${area.id}" ${entity.areaId === area.id ? "selected" : ""}>${escapeHtml(area.name)}</option>`).join("");
  const projectOptions = options.projects.map((project) => `<option value="${project.id}" ${entity.projectId === project.id ? "selected" : ""}>${escapeHtml(project.name)}</option>`).join("");
  const objectiveOptions = options.objectives.map((objective) => `<option value="${objective.id}" ${entity.objectiveId === objective.id ? "selected" : ""}>${escapeHtml(objective.title)}</option>`).join("");
  const dayTypeOptions = options.dayTypes.map((type) => `<option value="${type.id}" ${entity.typeId === type.id ? "selected" : ""}>${escapeHtml(type.label)}</option>`).join("");
  const periodOptions = options.periods.map((period) => `<option value="${period.id}" ${entity.scheduledPeriod === period.id || entity.period === period.id ? "selected" : ""}>${escapeHtml(period.label)}</option>`).join("");
  const actions = entity.id ? `<div class="toolbar-row"><button class="ghost-button" type="button" data-action="duplicate-entity" data-kind="${kind}" data-id="${entity.id}">Duplicar</button><button class="ghost-button danger" type="button" data-action="delete-entity" data-kind="${kind}" data-id="${entity.id}">Excluir</button></div>` : "";
  const taskFields = `<label class="field"><span>Titulo</span><input name="title" value="${escapeHtml(entity.title || "")}" required /></label><label class="field"><span>Subtarefas</span><textarea name="subtasks">${escapeHtml((entity.subtasks || []).join("\n"))}</textarea></label><div class="field-grid two"><label class="field"><span>Area</span><select name="areaId">${areaOptions}</select></label><label class="field"><span>Projeto</span><select name="projectId"><option value="">Sem projeto</option>${projectOptions}</select></label></div><div class="field-grid two"><label class="field"><span>Objetivo</span><select name="objectiveId"><option value="">Sem objetivo</option>${objectiveOptions}</select></label><label class="field"><span>Contexto</span><input name="context" value="${escapeHtml(entity.context || "")}" /></label></div><div class="field-grid four"><label class="field"><span>Periodo</span><select name="scheduledPeriod">${periodOptions}</select></label><label class="field"><span>Prioridade</span><input name="priority" value="${escapeHtml(entity.priority || "medium")}" /></label><label class="field"><span>Impacto</span><input type="number" name="impact" value="${escapeHtml(entity.impact || 3)}" /></label><label class="field"><span>Urgencia</span><input type="number" name="urgency" value="${escapeHtml(entity.urgency || 3)}" /></label></div><div class="field-grid four"><label class="field"><span>Esforco</span><input type="number" name="effort" value="${escapeHtml(entity.effort || 3)}" /></label><label class="field"><span>Duracao</span><input type="number" name="estimatedMinutes" value="${escapeHtml(entity.estimatedMinutes || 30)}" /></label><label class="field"><span>GTD</span><input name="gtdDecision" value="${escapeHtml(entity.gtdDecision || "Executar")}" /></label><label class="field"><span>Bucket</span><input name="finalBucket" value="${escapeHtml(entity.finalBucket || "priority")}" /></label></div><div class="field-grid three"><label class="field"><span>Dia</span><input type="date" name="scheduledDate" value="${escapeHtml(entity.scheduledDate || "")}" /></label><label class="field"><span>Prazo</span><input type="date" name="dueDate" value="${escapeHtml(entity.dueDate || "")}" /></label><label class="field"><span>Ajuste de score</span><input type="number" name="scoreAdjustment" value="${escapeHtml(entity.scoreAdjustment || 0)}" /></label></div><label class="field"><span>Proxima acao</span><textarea name="nextAction">${escapeHtml(entity.nextAction || "")}</textarea></label><label class="field"><span>Observacoes</span><textarea name="notes">${escapeHtml(entity.notes || "")}</textarea></label><div class="checkbox-row"><label><input type="checkbox" name="critical" ${entity.critical ? "checked" : ""}/> Critica</label><label><input type="checkbox" name="delegable" ${entity.delegable ? "checked" : ""}/> Delegavel</label><label><input type="checkbox" name="isRecurring" ${entity.isRecurring ? "checked" : ""}/> Recorrente</label><label><input type="checkbox" name="isTemplate" ${entity.isTemplate ? "checked" : ""}/> Modelo</label><label><input type="checkbox" name="manualDecision" ${entity.manualDecision ? "checked" : ""}/> Decisao manual</label></div>`;
  const fieldMap = {
    task: taskFields,
    area: `<label class="field"><span>Nome</span><input name="name" value="${escapeHtml(entity.name || "")}" /></label><div class="field-grid two"><label class="field"><span>Tipo</span><input name="type" value="${escapeHtml(entity.type || "life")}" /></label><label class="field"><span>Cor</span><input name="color" value="${escapeHtml(entity.color || "")}" /></label></div><label class="field"><span>Descricao</span><textarea name="description">${escapeHtml(entity.description || "")}</textarea></label>`,
    project: `<label class="field"><span>Nome</span><input name="name" value="${escapeHtml(entity.name || "")}" /></label><div class="field-grid two"><label class="field"><span>Area</span><select name="areaId">${areaOptions}</select></label><label class="field"><span>Status</span><input name="status" value="${escapeHtml(entity.status || "active")}" /></label></div><label class="field"><span>Resumo</span><textarea name="summary">${escapeHtml(entity.summary || "")}</textarea></label>`,
    objective: `<label class="field"><span>Titulo</span><input name="title" value="${escapeHtml(entity.title || "")}" /></label><div class="field-grid three"><label class="field"><span>Area</span><select name="areaId">${areaOptions}</select></label><label class="field"><span>Projeto</span><select name="projectId"><option value="">Sem projeto</option>${projectOptions}</select></label><label class="field"><span>Progresso</span><input type="number" name="progress" value="${escapeHtml(entity.progress || 0)}" /></label></div><label class="field"><span>Prazo</span><input type="date" name="dueDate" value="${escapeHtml(entity.dueDate || "")}" /></label><label class="field"><span>Descricao</span><textarea name="description">${escapeHtml(entity.description || "")}</textarea></label>`,
    habit: `<label class="field"><span>Titulo</span><input name="title" value="${escapeHtml(entity.title || "")}" /></label><div class="field-grid two"><label class="field"><span>Area</span><select name="areaId">${areaOptions}</select></label><label class="field"><span>Meta semanal</span><input type="number" name="targetPerWeek" value="${escapeHtml(entity.targetPerWeek || 3)}" /></label></div><label class="field"><span>Dias preferidos</span><input name="preferredWeekdays" value="${escapeHtml((entity.preferredWeekdays || []).join(", "))}" /></label><label class="field"><span>Nota</span><textarea name="note">${escapeHtml(entity.note || "")}</textarea></label>`,
    block: `<label class="field"><span>Titulo</span><input name="title" value="${escapeHtml(entity.title || "")}" /></label><div class="field-grid three"><label class="field"><span>Area</span><select name="areaId">${areaOptions}</select></label><label class="field"><span>Data</span><input type="date" name="date" value="${escapeHtml(entity.date || "")}" /></label><label class="field"><span>Periodo</span><select name="period">${periodOptions}</select></label></div><div class="field-grid two"><label class="field"><span>Inicio</span><input type="time" name="startTime" value="${escapeHtml(entity.startTime || "09:00")}" /></label><label class="field"><span>Fim</span><input type="time" name="endTime" value="${escapeHtml(entity.endTime || "10:00")}" /></label></div><label class="field"><span>Tipo</span><input name="kind" value="${escapeHtml(entity.kind || "routine")}" /></label><label class="field"><span>Nota</span><textarea name="note">${escapeHtml(entity.note || "")}</textarea></label>`,
    routine: `<label class="field"><span>Titulo</span><input name="title" value="${escapeHtml(entity.title || "")}" /></label><div class="field-grid three"><label class="field"><span>Periodo</span><select name="period">${periodOptions}</select></label><label class="field"><span>Area</span><select name="areaId">${areaOptions}</select></label><label class="field"><span>Ordem</span><input type="number" name="order" value="${escapeHtml(entity.order || 1)}" /></label></div><label class="field"><span>Nota</span><textarea name="note">${escapeHtml(entity.note || "")}</textarea></label><div class="checkbox-row"><label><input type="checkbox" name="active" ${entity.active ? "checked" : ""}/> Ativo</label><label><input type="checkbox" name="recurring" ${entity.recurring ? "checked" : ""}/> Recorrente</label></div>`,
    "day-override": `<label class="field"><span>Data</span><input type="date" name="date" value="${escapeHtml(entity.date || "")}" /></label><label class="field"><span>Tipo de dia</span><select name="typeId">${dayTypeOptions}</select></label><label class="field"><span>Nota</span><textarea name="note">${escapeHtml(entity.note || "")}</textarea></label>`,
  };
  return `<div class="modal-shell" data-action="close-editor-backdrop"><div class="modal-card" role="dialog" aria-modal="true"><div class="panel-head"><h3>Editar ${escapeHtml(kind)}</h3><button class="ghost-button" type="button" data-action="close-editor">Fechar</button></div>${actions}<form class="form-grid" data-form="entity-editor"><input type="hidden" name="kind" value="${escapeHtml(kind)}" /><input type="hidden" name="id" value="${escapeHtml(entity.id || "")}" />${fieldMap[kind] || fieldMap["day-override"]}<div class="toolbar-row"><button class="primary-button" type="submit">Salvar</button><button class="ghost-button" type="button" data-action="close-editor">Cancelar</button></div></form></div></div>`;
}

function formDataToObject(form) {
  const payload = {};
  const data = new FormData(form);
  for (const [key, value] of data.entries()) payload[key] = value;
  form.querySelectorAll('input[type="checkbox"]').forEach((field) => { payload[field.name] = field.checked; });
  return payload;
}

function renderActivePage(model, options = {}) {
  switch (model.activeSection) {
    case "dashboard": return renderDashboardPage(model);
    case "days": return renderDaysPage(model);
    case "inbox": return renderInboxPage(model);
    case "prioritize": return renderPrioritizePage(model, options);
    case "organize": return renderOrganizePage(model, options);
    case "areas": return renderAreasPage(model);
    case "projects": return renderProjectsPage(model);
    case "routine": return renderRoutinePage(model);
    case "planning": return renderPlanningPage(model);
    case "agenda": return renderAgendaPage(model);
    case "settings": return renderSettingsPage(model);
    case "today":
    default:
      return renderTodayPage(model, options);
  }
}

function renderFooter(model) {
  return `
    <footer class="workspace-footer">
      <p>Persistencia local em IndexedDB. Para Google Calendar, rode em servidor local e siga <a href="./docs/google-calendar.md">docs/google-calendar.md</a>.</p>
      <p>Data de hoje: ${escapeHtml(formatShortDate(model.today))}</p>
    </footer>
  `;
}

function renderLayoutSummary(layouts = {}) {
  return Object.entries(layouts).map(([page, entries]) => `
    <article class="layout-summary-card">
      <strong>${escapeHtml(page === "dashboard" ? "Dashboard" : "Hoje")}</strong>
      <div class="layout-summary-list">
        ${(entries || []).map((entry) => `<span class="meta-pill">${escapeHtml(entry.id)} • ${escapeHtml(LAYOUT_WIDTH_LABELS[entry.width] || entry.width)} • ${escapeHtml(LAYOUT_HEIGHT_LABELS[entry.height] || entry.height)}</span>`).join("")}
      </div>
    </article>
  `).join("");
}

export class LifeOSApp {
  constructor(root) {
    this.root = root;
    this.state = null;
    this.toast = "";
    this.toastTimer = null;
    this.dragItem = null;
    this.mobileNavOpen = false;
    this.lastIsMobile = false;
  }

  async init() {
    const loaded = await loadAppState(() => buildSeedState(new Date()));
    const incompatible = !loaded?.meta || Number(loaded.meta.version || 0) < APP_VERSION;
    this.state = incompatible ? await resetAppState(() => buildSeedState(new Date())) : loaded;
    this.lastIsMobile = this.isMobileViewport();
    if (this.lastIsMobile && this.state?.ui?.activeSection !== "today") {
      this.state = setActiveSection(this.state, "today");
      await saveAppState(this.state);
    }
    this.bindEvents();
    this.render();
    window.requestAnimationFrame(() => this.handleResize());
    window.setTimeout(() => this.handleResize(), 120);
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => void this.handleClick(event));
    this.root.addEventListener("submit", (event) => void this.handleSubmit(event));
    this.root.addEventListener("change", (event) => void this.handleChange(event));
    this.root.addEventListener("dragstart", (event) => this.handleDragStart(event));
    this.root.addEventListener("dragover", (event) => this.handleDragOver(event));
    this.root.addEventListener("drop", (event) => void this.handleDrop(event));
    this.root.addEventListener("dragend", () => this.handleDragEnd());
    window.addEventListener("resize", () => this.handleResize());
  }

  isMobileViewport() {
    const widths = [
      window.innerWidth,
      window.document?.documentElement?.clientWidth,
      window.visualViewport?.width,
      window.screen?.width,
    ].filter((value) => Number.isFinite(value) && value > 0);
    const smallestWidth = widths.length ? Math.min(...widths) : Number.POSITIVE_INFINITY;
    const mobileAgent = /Android|webOS|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent || "");
    const touchMobile = (window.navigator.maxTouchPoints || 0) > 1 && smallestWidth <= 1024;
    return smallestWidth <= MOBILE_BREAKPOINT || window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches || mobileAgent || touchMobile;
  }

  handleResize() {
    const isMobile = this.isMobileViewport();
    if (isMobile === this.lastIsMobile) return;
    this.lastIsMobile = isMobile;
    if (isMobile && this.state?.ui?.activeSection !== "today") {
      this.state = setActiveSection(this.state, "today");
    }
    if (!isMobile) this.mobileNavOpen = false;
    this.render();
  }

  showToast(message) {
    this.toast = message;
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast = "";
      this.render();
    }, 2800);
  }

  async persist(message = "") {
    await saveAppState(this.state);
    if (message) this.showToast(message);
    this.render();
  }

  async handleClick(event) {
    const trigger = event.target.closest("[data-action], [data-task-action]");
    if (!trigger) return;
    const today = formatISODate(new Date());

    if (trigger.dataset.taskAction) {
      this.state = applyTaskAction(this.state, trigger.dataset.taskId, trigger.dataset.taskAction, {}, this.state.ui.selectedDate || today);
      await this.persist("Tarefa atualizada.");
      return;
    }

    const action = trigger.dataset.action;
    if (action === "toggle-mobile-nav") { this.mobileNavOpen = true; this.render(); return; }
    if (action === "close-mobile-nav") { this.mobileNavOpen = false; this.render(); return; }
    if (action === "navigate") { this.state = setActiveSection(this.state, trigger.dataset.section); this.mobileNavOpen = false; await this.persist(); return; }
    if (action === "select-day") { this.state = setSelectedDate(this.state, trigger.dataset.date); await this.persist(); return; }
    if (action === "set-filter") { this.state = setFilter(this.state, trigger.dataset.filterName, trigger.dataset.filterValue); await this.persist(); return; }
    if (action === "clear-filters") { this.state = clearFilters(this.state); await this.persist("Filtros limpos."); return; }
    if (action === "set-priority-method") { this.state = setPriorityMethod(this.state, trigger.dataset.method); await this.persist("Metodo atualizado."); return; }
    if (action === "set-energy") { this.state = setWeeklyEnergy(this.state, trigger.dataset.energy); await this.persist("Energia semanal ajustada."); return; }
    if (action === "toggle-habit") { this.state = toggleHabitForDate(this.state, trigger.dataset.habitId, trigger.dataset.date || today); await this.persist("Habito atualizado."); return; }
    if (action === "open-editor") { this.state = openEditor(this.state, trigger.dataset.kind, trigger.dataset.id || ""); this.render(); return; }
    if (action === "close-editor" || action === "close-editor-backdrop") { if (action === "close-editor-backdrop" && event.target !== trigger) return; this.state = closeEditor(this.state); this.render(); return; }
    if (action === "duplicate-entity") { this.state = duplicateEntity(this.state, trigger.dataset.kind, trigger.dataset.id); await this.persist("Item duplicado."); return; }
    if (action === "delete-entity") { if (!window.confirm("Deseja excluir este item?")) return; this.state = deleteEntity(this.state, trigger.dataset.kind, trigger.dataset.id); await this.persist("Item removido."); return; }
    if (action === "replan-week") { const result = replanWeek(this.state, this.state.ui.selectedDate || today); this.state = result.nextState; await this.persist(`Semana reorganizada: ${result.movedCount} movidas, ${result.alertCount} alertas e ${result.reviewCount} revisoes.`); return; }
    if (action === "toggle-edit-mode") { this.state = toggleEditMode(this.state); await this.persist("Modo de edicao atualizado."); return; }
    if (action === "resize-layout-card") {
      this.state = resizeLayoutCard(
        this.state,
        trigger.dataset.layoutPage,
        trigger.dataset.layoutCard,
        trigger.dataset.layoutDimension,
        trigger.dataset.layoutDirection,
      );
      await this.persist("Tamanho do bloco atualizado.");
      return;
    }
    if (action === "save-layout-default") { this.state = saveCurrentLayoutAsDefault(this.state); await this.persist("Layout atual salvo."); return; }
    if (action === "restore-layout-default") { this.state = restoreLayoutDefault(this.state); await this.persist("Layout restaurado."); return; }
    if (action === "connect-google") { await this.handleGoogleConnect(); return; }
    if (action === "sync-google") { await this.handleGoogleSync(); return; }
    if (action === "reset-app") { if (!window.confirm("Deseja resetar a base local para a seed atual?")) return; this.state = await resetAppState(() => buildSeedState(new Date())); this.showToast("Base local resetada."); this.render(); }
  }

  async handleChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    if (target.dataset.filter) { this.state = setFilter(this.state, target.dataset.filter, target.value); await this.persist(); return; }
    if (target.dataset.dayTypeDate) { const result = setDayType(this.state, target.dataset.dayTypeDate, target.value); this.state = result.nextState; await this.persist(`Dia recalculado: ${result.movedCount} movidas, ${result.alertCount} alertas.`); return; }
    if (target.dataset.periodTypeDate) { const result = setDayPeriodType(this.state, target.dataset.periodTypeDate, target.dataset.periodId, target.value); this.state = result.nextState; await this.persist(`Periodo recalculado: ${result.movedCount} movidas, ${result.alertCount} alertas.`); }
  }

  async handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (form.dataset.form === "capture-task") { this.state = addInboxTask(this.state, formDataToObject(form)); form.reset(); await this.persist("Nova tarefa capturada na inbox."); return; }
    if (form.dataset.form === "google-config") { this.state = saveGoogleCalendarConfig(this.state, formDataToObject(form)); await this.persist("Configuracao do Google salva."); return; }
    if (form.dataset.form === "entity-editor") { const payload = formDataToObject(form); this.state = saveEntity(this.state, payload.kind, payload); await this.persist("Item salvo."); return; }
    if (form.dataset.form === "settings-form") { this.state = saveSettings(this.state, formDataToObject(form)); await this.persist("Configuracoes salvas."); }
  }

  handleDragStart(event) {
    const item = event.target.closest("[data-layout-card]");
    if (!item || !this.state?.settings?.editMode || !this.state?.settings?.layoutCapabilities?.dragEnabled) return;
    this.dragItem = { page: item.dataset.layoutPage, cardId: item.dataset.layoutCard };
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
  }

  handleDragOver(event) {
    const item = event.target.closest("[data-layout-card]");
    if (!item || !this.dragItem) return;
    event.preventDefault();
  }

  async handleDrop(event) {
    const item = event.target.closest("[data-layout-card]");
    if (!item || !this.dragItem) return;
    event.preventDefault();
    if (this.dragItem.page !== item.dataset.layoutPage) {
      this.dragItem = null;
      return;
    }
    this.state = moveLayoutCard(this.state, this.dragItem.page, this.dragItem.cardId, item.dataset.layoutCard);
    this.dragItem = null;
    await this.persist("Layout reorganizado.");
  }

  handleDragEnd() {
    this.dragItem = null;
    this.root.querySelectorAll(".layout-card.dragging").forEach((card) => card.classList.remove("dragging"));
  }

  async handleGoogleConnect() {
    try {
      const service = new GoogleCalendarService(this.state.settings.googleCalendar);
      await service.connect();
      this.state = setCalendarConnected(this.state, true);
      await this.persist("Google Calendar conectado.");
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : "Falha ao conectar com Google Calendar.");
      this.render();
    }
  }

  async handleGoogleSync() {
    try {
      const service = new GoogleCalendarService(this.state.settings.googleCalendar);
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const blocks = await service.listBusyBlocks({ calendarId: this.state.settings.googleCalendar.calendarId || "primary", timeMin, timeMax });
      this.state = applyGoogleBusyBlocks(this.state, blocks);
      await this.persist(`${blocks.length} bloco(s) sincronizado(s).`);
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : "Falha ao sincronizar Google Calendar.");
      this.render();
    }
  }

  render() {
    if (!this.state) {
      this.root.innerHTML = `<div class="app-shell"><div class="panel-card">Carregando Life OS Thz 2026...</div></div>`;
      return;
    }

    const model = buildAppModel(this.state, new Date());
    const isMobile = this.isMobileViewport();
    this.lastIsMobile = isMobile;
    if (!isMobile) this.mobileNavOpen = false;
    this.root.innerHTML = isMobile
      ? `<div class="app-shell mobile-shell density-${escapeHtml(model.settings.visualDensity)} tone-${escapeHtml(model.settings.accentTone)}">${this.toast ? `<div class="toast">${escapeHtml(this.toast)}</div>` : ""}${this.mobileNavOpen ? `<button class="mobile-nav-backdrop" data-action="close-mobile-nav" aria-label="Fechar menu"></button>` : ""}${renderSidebar(model, { isMobile: true, navOpen: this.mobileNavOpen })}<main class="workspace-main mobile-main">${renderMobileTopbar(model, { navOpen: this.mobileNavOpen })}${renderHeader(model, { isMobile: true })}<div class="page-shell">${renderActivePage(model, { isMobile: true })}</div>${renderFooter(model)}</main>${renderFloatingAlert(model.activeSection === "today" ? model.floatingAlert : null, { isMobile: true })}${renderEditorModal(model.editorView, model.options)}</div>`
      : `<div class="app-shell desktop-shell density-${escapeHtml(model.settings.visualDensity)} tone-${escapeHtml(model.settings.accentTone)}">${this.toast ? `<div class="toast">${escapeHtml(this.toast)}</div>` : ""}<main class="workspace-root">${renderHeader(model, { isMobile: false })}<section class="workspace-desktop-grid"><div class="workspace-sidebar-column">${renderSidebar(model, { isMobile: false, navOpen: false })}</div><section class="workspace-content-column"><div class="page-shell">${renderActivePage(model, { isMobile: false })}</div>${renderFooter(model)}</section></section></main>${renderFloatingAlert(model.activeSection === "today" ? model.floatingAlert : null, { isMobile: false })}${renderEditorModal(model.editorView, model.options)}</div>`;
  }
}



