import {
  addDays,
  clamp,
  createLocalDateTime,
  differenceInDays,
  formatISODate,
  formatLongDate,
  formatShortDate,
  formatWeekday,
  getWeekDates,
  getWeekdayKey,
} from "./date.js";

const DEFAULT_FILTERS = {
  scope: "integrated",
  areaId: "all",
  projectId: "all",
  context: "all",
  dayTypeId: "all",
};

const ENERGY_FACTOR = { 1: 0.7, 2: 0.85, 3: 1, 4: 1.12, 5: 1.22 };
const PRIORITY_BASE = { low: 18, medium: 30, high: 44 };
const LAYOUT_WIDTH_ORDER = ["compact", "medium", "full"];
const LAYOUT_HEIGHT_ORDER = ["compact", "regular", "tall"];
const DEFAULT_LAYOUTS = {
  dashboard: [
    { id: "overview", width: "full", height: "compact", frame: null },
    { id: "radar", width: "medium", height: "tall", frame: null },
    { id: "goals", width: "medium", height: "regular", frame: null },
    { id: "areas", width: "medium", height: "regular", frame: null },
    { id: "projects", width: "medium", height: "regular", frame: null },
    { id: "load", width: "full", height: "compact", frame: null },
  ],
  today: [
    { id: "focus", width: "full", height: "regular", frame: null },
    { id: "queue", width: "medium", height: "regular", frame: null },
    { id: "calendar", width: "medium", height: "regular", frame: null },
    { id: "alerts", width: "full", height: "regular", frame: null },
  ],
};

const PERIODS = [
  { id: "morning", label: "Manha", baseMinutes: 105, startMinute: 450 },
  { id: "afternoon", label: "Tarde", baseMinutes: 220, startMinute: 780 },
  { id: "night", label: "Noite", baseMinutes: 95, startMinute: 1290 },
];

const METHOD_LABELS = {
  pipeline: "Pipeline completo",
  gtd: "GTD",
  frog: "Engolindo o sapo",
  agile: "Metodos ageis",
  scrum: "Scrum pessoal",
};

const METHOD_GUIDES = {
  pipeline: "Processa, explica, simplifica e so depois manda para o dia ou para a semana.",
  gtd: "Prioriza o que precisa de clareza, proxima acao e decisao pratica.",
  frog: "Traz para cima a tarefa mais importante e mais dificil para atacar cedo.",
  agile: "Refina por impacto, urgencia, esforco, carga e encaixe real na agenda.",
  scrum: "Puxa o que move sprint, backlog ativo e previsibilidade dos projetos.",
};

const ORGANIZE_BUCKETS = [
  { id: "do-now", label: "Fazer agora" },
  { id: "priority", label: "Prioridade" },
  { id: "schedule", label: "Agendar" },
  { id: "delegate", label: "Delegar" },
  { id: "waiting", label: "Aguardar" },
  { id: "backlog", label: "Backlog" },
];

const TASK_TYPES = [
  "task",
  "strategic",
  "work",
  "health",
  "review",
  "planning",
  "family",
  "finance",
  "home",
  "visit",
  "move",
  "creative",
  "idea",
  "template",
];

const TASK_CONTEXTS = [
  "flex",
  "deep-work",
  "admin",
  "planning",
  "health",
  "home",
  "outside",
  "street",
  "creative",
];

function cloneValue(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function normalizeLayoutEntry(entry, fallback) {
  const source = typeof entry === "string" ? { id: entry } : (entry || {});
  const base = fallback || source;

  return {
    id: source.id || base.id,
    width: LAYOUT_WIDTH_ORDER.includes(source.width) ? source.width : (base.width || "medium"),
    height: LAYOUT_HEIGHT_ORDER.includes(source.height) ? source.height : (base.height || "regular"),
    frame: source.frame && typeof source.frame === "object"
      ? {
        x: Number.isFinite(source.frame.x) ? source.frame.x : null,
        y: Number.isFinite(source.frame.y) ? source.frame.y : null,
        w: Number.isFinite(source.frame.w) ? source.frame.w : null,
        h: Number.isFinite(source.frame.h) ? source.frame.h : null,
      }
      : (base.frame ? cloneValue(base.frame) : null),
  };
}

function normalizeLayoutPage(layoutPage = [], fallbackPage = []) {
  const source = Array.isArray(layoutPage) && layoutPage.length ? layoutPage : fallbackPage;
  const fallbackMap = new Map((fallbackPage || []).map((entry) => [entry.id, normalizeLayoutEntry(entry)]));
  const normalized = [];
  const seen = new Set();

  source.forEach((entry) => {
    const id = typeof entry === "string" ? entry : entry?.id;
    const fallback = fallbackMap.get(id);
    if (!id || seen.has(id) || !fallback) {
      return;
    }

    normalized.push(normalizeLayoutEntry(entry, fallback));
    seen.add(id);
  });

  fallbackPage.forEach((entry) => {
    if (!seen.has(entry.id)) {
      normalized.push(normalizeLayoutEntry(entry));
    }
  });

  return normalized;
}

function normalizeLayouts(layouts = DEFAULT_LAYOUTS, fallbackLayouts = DEFAULT_LAYOUTS) {
  return {
    dashboard: normalizeLayoutPage(layouts?.dashboard, fallbackLayouts.dashboard || DEFAULT_LAYOUTS.dashboard),
    today: normalizeLayoutPage(layouts?.today, fallbackLayouts.today || DEFAULT_LAYOUTS.today),
  };
}

function cloneLayouts(layouts = DEFAULT_LAYOUTS) {
  return normalizeLayouts(cloneValue(layouts), DEFAULT_LAYOUTS);
}

function stepLayoutValue(current, options, direction, fallback) {
  const safeCurrent = options.includes(current) ? current : fallback;
  const currentIndex = options.indexOf(safeCurrent);
  const nextIndex = clamp(currentIndex + (direction === "increase" ? 1 : -1), 0, options.length - 1);
  return options[nextIndex];
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return ["true", "1", "on", "yes"].includes(String(value).toLowerCase());
}

function parseSubtasks(value, existing = []) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return existing || [];
}

function pushHistory(state, type, summary, meta = {}) {
  state.history.unshift({
    id: makeId("history"),
    type,
    summary,
    meta,
    createdAt: nowIso(),
  });
  state.history = state.history.slice(0, 250);
}

function prepareState(state) {
  state.meta = state.meta || { appName: "Life OS Thz 2026", version: 4 };
  state.profile = state.profile || {};
  state.tasks = state.tasks || [];
  state.areas = state.areas || [];
  state.projects = state.projects || [];
  state.objectives = state.objectives || [];
  state.sprints = state.sprints || [];
  state.blocks = state.blocks || [];
  state.dayTypes = state.dayTypes || [];
  state.dayOverrides = state.dayOverrides || [];
  state.habits = state.habits || [];
  state.history = state.history || [];
  state.routines = state.routines || { morning: [], night: [] };
  state.weeklyPlan = {
    energyLevel: toNumber(state.weeklyPlan?.energyLevel, 3),
    mainFocus: state.weeklyPlan?.mainFocus || "",
  };

  const layoutDefaults = normalizeLayouts(state.settings?.layoutDefaults || DEFAULT_LAYOUTS, DEFAULT_LAYOUTS);
  const layouts = normalizeLayouts(state.settings?.layouts || layoutDefaults, layoutDefaults);

  state.settings = {
    editMode: Boolean(state.settings?.editMode),
    visualDensity: state.settings?.visualDensity || "calm",
    accentTone: state.settings?.accentTone || "sand",
    layoutDefaults,
    layouts,
    layoutMode: state.settings?.layoutMode || "flex-grid",
    layoutCapabilities: {
      resizeEnabled: toBoolean(state.settings?.layoutCapabilities?.resizeEnabled, true),
      dragEnabled: toBoolean(state.settings?.layoutCapabilities?.dragEnabled, true),
      futureFreeformReady: toBoolean(state.settings?.layoutCapabilities?.futureFreeformReady, true),
    },
    prioritization: {
      healthProtection: toNumber(state.settings?.prioritization?.healthProtection, 1.1),
      moveProtection: toNumber(state.settings?.prioritization?.moveProtection, 1.18),
      familyProtection: toNumber(state.settings?.prioritization?.familyProtection, 1.08),
      futureFocus: toNumber(state.settings?.prioritization?.futureFocus, 1.12),
      delegationBias: toNumber(state.settings?.prioritization?.delegationBias, 1.05),
      overloadLimit: toNumber(state.settings?.prioritization?.overloadLimit, 0.92),
    },
    reasoningLine: state.settings?.reasoningLine || "",
    googleCalendar: {
      clientId: state.settings?.googleCalendar?.clientId || "",
      apiKey: state.settings?.googleCalendar?.apiKey || "",
      calendarId: state.settings?.googleCalendar?.calendarId || "primary",
    },
    architecture: {
      workModuleMode: state.settings?.architecture?.workModuleMode || "embedded",
      futureApiReady: toBoolean(state.settings?.architecture?.futureApiReady, true),
    },
  };

  state.ui = {
    activeSection: state.ui?.activeSection || "today",
    selectedDate: state.ui?.selectedDate || formatISODate(new Date()),
    priorityMethod: state.ui?.priorityMethod || "pipeline",
    filters: { ...DEFAULT_FILTERS, ...(state.ui?.filters || {}) },
    editor: {
      kind: state.ui?.editor?.kind || "",
      id: state.ui?.editor?.id || "",
    },
  };

  state.calendar = {
    provider: state.calendar?.provider || "google",
    connected: Boolean(state.calendar?.connected),
    calendarId: state.calendar?.calendarId || state.settings.googleCalendar.calendarId,
    externalBusyBlocks: state.calendar?.externalBusyBlocks || [],
  };

  return state;
}

function cloneState(state) {
  return prepareState(cloneValue(state));
}

function getAreaById(state, areaId) {
  return state.areas.find((area) => area.id === areaId) || null;
}

function getProjectById(state, projectId) {
  return state.projects.find((project) => project.id === projectId) || null;
}

function getObjectiveById(state, objectiveId) {
  return state.objectives.find((objective) => objective.id === objectiveId) || null;
}

function getSprintById(state, sprintId) {
  return state.sprints.find((sprint) => sprint.id === sprintId) || null;
}

function getTaskById(state, taskId) {
  return state.tasks.find((task) => task.id === taskId) || null;
}

function getDayOverride(state, date) {
  return state.dayOverrides.find((entry) => entry.date === date) || null;
}

function getDayTypeById(state, typeId) {
  return (
    state.dayTypes.find((type) => type.id === typeId) ||
    state.dayTypes.find((type) => type.id === "normal") ||
    state.dayTypes[0]
  );
}

function getDefaultDayTypeId(state, date) {
  const weekday = getWeekdayKey(date);

  if (weekday === "sabado") {
    return "saturday";
  }

  if (weekday === "domingo") {
    return "sunday";
  }

  if (weekday === "quarta" || weekday === "sexta") {
    return "soccer";
  }

  return getDayTypeById(state, "normal")?.id || "normal";
}

function defaultPeriodsForType(state, typeId) {
  const type = getDayTypeById(state, typeId);
  return cloneValue(type?.periodDefaults || { morning: typeId, afternoon: typeId, night: typeId });
}

function getWeekEnergyLabel(level) {
  return {
    1: "Muito baixa",
    2: "Baixa",
    3: "Estavel",
    4: "Boa",
    5: "Alta",
  }[Number(level)] || "Estavel";
}

function guessPeriod(task) {
  if (task.scheduledPeriod && PERIODS.some((period) => period.id === task.scheduledPeriod)) {
    return task.scheduledPeriod;
  }

  if (["deep-work", "creative", "planning"].includes(task.context)) {
    return "afternoon";
  }

  if (["health"].includes(task.context)) {
    return "night";
  }

  if (["home", "admin"].includes(task.context) || ["family", "home"].includes(task.type)) {
    return "morning";
  }

  return "afternoon";
}

function resolveDayProfile(state, date) {
  const override = getDayOverride(state, date);
  const typeId = override?.typeId || getDefaultDayTypeId(state, date);
  const type = getDayTypeById(state, typeId);
  const periodMap = { ...defaultPeriodsForType(state, typeId), ...(override?.periods || {}) };
  const energyFactor = ENERGY_FACTOR[toNumber(state.weeklyPlan.energyLevel, 3)] || 1;

  const periods = PERIODS.map((period) => {
    const periodType = getDayTypeById(state, periodMap[period.id] || typeId);
    const percentage = toNumber(periodType?.percentage, 100) / 100;
    const capacity = Math.max(10, Math.round(period.baseMinutes * energyFactor * percentage));

    return {
      ...period,
      type: periodType,
      typeId: periodType?.id || typeId,
      capacity,
    };
  });

  const totalCapacity = periods.reduce((sum, period) => sum + period.capacity, 0);

  return {
    date,
    type,
    note: override?.note || "",
    periods,
    totalCapacity,
    lowCapacity: totalCapacity <= 170 || periods.some((period) => period.typeId === "external"),
    longLabel: formatLongDate(date),
    weekdayLabel: formatWeekday(date),
    shortLabel: formatShortDate(date),
  };
}

function isTemplateTask(task) {
  return task.isTemplate || task.location === "template" || task.status === "template";
}

function isDoneLike(task) {
  return ["done", "discarded", "delegated"].includes(task.status);
}

function isOpenTask(task) {
  return !isDoneLike(task) && !isTemplateTask(task);
}

function reasoningFlags(state) {
  const source = String(state.settings.reasoningLine || "").toLowerCase();

  return {
    protectHealth: source.includes("saude") || source.includes("treino") || source.includes("alimentacao"),
    protectMove: source.includes("mudanca"),
    protectFamily: source.includes("filhos") || source.includes("familia"),
    focusFuture: source.includes("futuro") || source.includes("renda") || source.includes("estabilidade"),
    prefersClarity: source.includes("clareza") || source.includes("proxima acao"),
    avoidOverload: source.includes("sobrecarga") || source.includes("poucas tarefas"),
    delegation: source.includes("deleg"),
    backlogHygiene: source.includes("backlog"),
  };
}

function defaultNextAction(task) {
  if (task.nextAction) {
    return task.nextAction;
  }

  if (task.subtasks?.length) {
    return task.subtasks[0];
  }

  if (toNumber(task.estimatedMinutes, 30) >= 90 || toNumber(task.effort, 3) >= 4) {
    return `quebrar ${task.title.toLowerCase()} em uma proxima acao de 20 a 30 min`;
  }

  if (task.context === "deep-work") {
    return `abrir o material e iniciar a primeira etapa de ${task.title.toLowerCase()}`;
  }

  if (task.type === "health") {
    return `reservar ${task.estimatedMinutes} min para ${task.title.toLowerCase()}`;
  }

  return `comecar por ${task.title.toLowerCase()}`;
}

function classifyTask(task, state, referenceDate, flags) {
  const reasons = [];
  const dueDelta = task.dueDate ? differenceInDays(task.dueDate, referenceDate) : 99;
  const scheduledDelta = task.scheduledDate ? differenceInDays(task.scheduledDate, referenceDate) : 99;

  if (isTemplateTask(task)) {
    return {
      stage: "template",
      decision: "Modelo",
      bucket: "backlog",
      nextAction: "instanciar quando precisar",
      reasons: ["ja esta salvo como modelo"],
    };
  }

  if (task.status === "discarded" || task.location === "discarded") {
    return {
      stage: "clarify",
      decision: "Descartar",
      bucket: "backlog",
      nextAction: "",
      reasons: ["ja foi descartada"],
    };
  }

  if (task.status === "delegated" || task.location === "delegated") {
    return {
      stage: "organize",
      decision: "Delegar",
      bucket: "delegate",
      nextAction: task.nextAction || "acompanhar retorno",
      reasons: ["ja saiu da sua execucao direta"],
    };
  }

  if (task.status === "waiting" || task.location === "waiting") {
    return {
      stage: "organize",
      decision: "Aguardar",
      bucket: "waiting",
      nextAction: task.nextAction || "acompanhar retorno externo",
      reasons: ["depende de retorno ou resposta"],
    };
  }

  let stage = "clarify";
  let decision = "Executar";
  let bucket = "priority";

  if (task.location === "inbox") {
    stage = "capture";
    decision = "Processar";
    bucket = "backlog";
    reasons.push("entrou pela inbox e ainda precisa de processamento");
  }

  if (task.type === "idea" && task.location === "inbox") {
    decision = "Backlog";
    stage = "clarify";
    bucket = "backlog";
    reasons.push("e uma ideia e nao precisa competir com a execucao");
  }

  if (task.location === "backlog") {
    decision = "Backlog";
    stage = "organize";
    bucket = "backlog";
    reasons.push("esta reservada para revisao e limpeza futura");
  }

  if (task.delegable && toNumber(task.impact, 3) <= 3 && toNumber(task.effort, 3) >= 4) {
    decision = "Delegar";
    stage = "clarify";
    bucket = "delegate";
    reasons.push("consome energia e pode valer mais delegada");
  }

  if ((toNumber(task.estimatedMinutes, 30) >= 90 || toNumber(task.effort, 3) >= 4) && !task.nextAction) {
    decision = "Projeto";
    stage = "clarify";
    bucket = task.scheduledDate ? "schedule" : "priority";
    reasons.push("esta grande demais para entrar sem refino");
  }

  if (task.scheduledDate && scheduledDelta > 0 && !["Delegar", "Backlog"].includes(decision)) {
    decision = "Agendar";
    stage = "organize";
    bucket = "schedule";
    reasons.push("ja tem dia reservado na semana");
  }

  if (task.scheduledDate && scheduledDelta <= 0 && !["Delegar", "Aguardar", "Descartar", "Backlog"].includes(decision)) {
    decision = "Executar";
    stage = "execute";
    bucket = scheduledDelta === 0 ? "do-now" : "priority";
    reasons.push(scheduledDelta < 0 ? "ja passou do dia planejado" : "cabe no dia selecionado");
  }

  if (dueDelta <= 1 && !["Delegar", "Aguardar", "Descartar", "Backlog"].includes(decision)) {
    decision = "Executar";
    stage = "execute";
    bucket = scheduledDelta === 0 ? "do-now" : "priority";
    reasons.push("tem prazo ou consequencia muito perto");
  }

  if (flags.prefersClarity && !task.nextAction && !isTemplateTask(task)) {
    reasons.push("a linha de raciocinio pede proxima acao clara");
  }

  return {
    stage,
    decision,
    bucket,
    nextAction: defaultNextAction(task),
    reasons: [...new Set(reasons)].slice(0, 4),
  };
}

function getMethodBonus(task, method, gtd) {
  const reasons = [];
  let score = 0;

  if (method === "pipeline") {
    if (gtd.decision === "Executar") {
      score += 8;
      reasons.push("ja passou pela triagem e esta pronto para executar");
    }
  }

  if (method === "gtd") {
    if (task.location === "inbox" || gtd.decision === "Projeto") {
      score += 16;
      reasons.push("o metodo GTD quer clareza antes da execucao");
    }
  }

  if (method === "frog") {
    if (toNumber(task.impact, 3) >= 4 && toNumber(task.effort, 3) >= 3) {
      score += 18;
      reasons.push("mistura importancia alta com dificuldade real");
    }
  }

  if (method === "agile") {
    if (toNumber(task.impact, 3) >= 4) {
      score += 8;
      reasons.push("tem impacto alto");
    }
    if (toNumber(task.urgency, 3) >= 4) {
      score += 8;
      reasons.push("tem urgencia alta");
    }
  }

  if (method === "scrum") {
    if (task.sprintId) {
      score += 16;
      reasons.push("move um sprint atual");
    }
    if (task.projectId) {
      score += 6;
      reasons.push("ajuda a dar previsibilidade ao projeto");
    }
  }

  return { score, reasons };
}

function scoreTask(task, state, referenceDate, dayProfile, gtd, flags, method) {
  const reasons = [...gtd.reasons];
  const settings = state.settings.prioritization;
  const dueDelta = task.dueDate ? differenceInDays(task.dueDate, referenceDate) : 99;
  const scheduledDelta = task.scheduledDate ? differenceInDays(task.scheduledDate, referenceDate) : 99;
  let score = PRIORITY_BASE[task.priority] || 30;

  score += toNumber(task.impact, 3) * 8;
  score += toNumber(task.urgency, 3) * 8;
  score -= toNumber(task.effort, 3) * 4;
  score += toNumber(task.scoreAdjustment, 0);

  if (task.objectiveId) {
    score += 12;
    reasons.push("esta ligada a um objetivo maior");
  }

  if (task.sprintId) {
    score += 10;
    reasons.push("move o sprint atual");
  }

  if (task.critical) {
    score += 16;
    reasons.push("foi marcada como critica");
  }

  if (task.projectId) {
    score += 4;
    reasons.push("pertence a um projeto ativo");
  }

  if (task.location === "inbox") {
    score -= 8;
  }

  if (task.location === "backlog") {
    score -= flags.backlogHygiene ? 10 : 4;
    reasons.push(flags.backlogHygiene ? "o sistema desconfia de backlog inflado" : "ainda esta no backlog");
  }

  if (scheduledDelta < 0) {
    score += Math.min(Math.abs(scheduledDelta) * 7, 24);
    reasons.push("ja atrasou no calendario");
  }

  if (dueDelta < 0) {
    score += Math.min(Math.abs(dueDelta) * 8, 28);
    reasons.push("esta vencida");
  } else if (dueDelta <= 2) {
    score += 12;
    reasons.push("tem prazo muito proximo");
  }

  if (flags.protectHealth && task.areaId === "area-health") {
    score += Math.round(8 * settings.healthProtection);
    reasons.push("sua linha de raciocinio protege saude");
  }

  if (flags.protectMove && task.areaId === "area-move") {
    score += Math.round(9 * settings.moveProtection);
    reasons.push("a mudanca tem prioridade estrutural");
  }

  if (flags.protectFamily && task.areaId === "area-family") {
    score += Math.round(6 * settings.familyProtection);
    reasons.push("familia faz parte da base do sistema");
  }

  if (flags.focusFuture && task.projectId) {
    score += Math.round(5 * settings.futureFocus);
    reasons.push("ajuda a construir renda e futuro");
  }

  if (flags.delegation && task.delegable && toNumber(task.effort, 3) >= 4) {
    reasons.push("delegar pode ser melhor do que absorver sozinho");
  }

  if (dayProfile) {
    const taskPeriod = dayProfile.periods.find((period) => period.id === guessPeriod(task));

    if (dayProfile.lowCapacity && !task.critical) {
      score -= 10;
      reasons.push("esta em um dia de capacidade reduzida");
    }

    if (taskPeriod && task.estimatedMinutes > taskPeriod.capacity * settings.overloadLimit) {
      score -= 10;
      reasons.push("esta pesada para o periodo atual");
    }

    if (taskPeriod?.typeId === "soccer" && task.estimatedMinutes > 50) {
      score -= 6;
      reasons.push("bate em um periodo protegido pelo futebol");
    }
  }

  const methodBonus = getMethodBonus(task, method, gtd);
  score += methodBonus.score;
  reasons.push(...methodBonus.reasons);

  return {
    score: Math.max(0, Math.round(score)),
    reasons: [...new Set(reasons)].slice(0, 5),
  };
}

function buildSuggestions(task, gtd, score, selectedDate, dayProfile) {
  const suggestions = [];

  if (gtd.decision === "Processar") {
    suggestions.push("processar na central");
  }

  if (score >= 90 && task.scheduledDate === selectedDate) {
    suggestions.push("entra entre as prioridades de hoje");
  }

  if (gtd.decision === "Projeto" || toNumber(task.estimatedMinutes, 30) >= 90) {
    suggestions.push("quebrar em partes menores");
  }

  if (task.delegable && toNumber(task.effort, 3) >= 4) {
    suggestions.push("avaliar delegacao");
  }

  if (dayProfile?.lowCapacity && !task.critical) {
    suggestions.push("reavaliar o encaixe neste dia");
  }

  if (gtd.decision === "Backlog" && score < 50) {
    suggestions.push("limpar ou descartar depois");
  }

  return suggestions.slice(0, 3);
}

function enrichTask(task, state, referenceDate, method = state.ui.priorityMethod || "pipeline") {
  const area = getAreaById(state, task.areaId);
  const project = getProjectById(state, task.projectId);
  const objective = getObjectiveById(state, task.objectiveId);
  const sprint = getSprintById(state, task.sprintId);
  const dayProfile = task.scheduledDate ? resolveDayProfile(state, task.scheduledDate) : null;
  const flags = reasoningFlags(state);
  const autoGtd = classifyTask(task, state, referenceDate, flags);
  const gtd = {
    stage: task.gtdStage || autoGtd.stage,
    decision: task.gtdDecision || autoGtd.decision,
    nextAction: task.nextAction || autoGtd.nextAction,
    bucket: task.finalBucket || autoGtd.bucket,
    reasons: autoGtd.reasons,
  };
  const scored = scoreTask(task, state, referenceDate, dayProfile, gtd, flags, method);
  const dueDelta = task.dueDate ? differenceInDays(task.dueDate, referenceDate) : 99;
  const scheduledDelta = task.scheduledDate ? differenceInDays(task.scheduledDate, referenceDate) : 99;

  return {
    ...task,
    area,
    areaName: area?.name || "Sem area",
    project,
    projectName: project?.name || "",
    objective,
    objectiveTitle: objective?.title || "",
    sprint,
    sprintTitle: sprint?.title || "",
    scheduledPeriod: guessPeriod(task),
    periodLabel: PERIODS.find((period) => period.id === guessPeriod(task))?.label || "Tarde",
    gtdStage: gtd.stage,
    gtdDecision: gtd.decision,
    nextAction: gtd.nextAction,
    finalBucket: gtd.bucket,
    score: scored.score,
    reasons: scored.reasons,
    suggestions: buildSuggestions(task, gtd, scored.score, referenceDate, dayProfile),
    scheduledLabel: task.scheduledDate ? formatShortDate(task.scheduledDate) : "",
    dueLabel: task.dueDate ? formatShortDate(task.dueDate) : "",
    dueDelta,
    scheduledDelta,
    isOverdue: dueDelta < 0 || scheduledDelta < 0,
    dayTypeId: dayProfile?.type.id || "",
    dayTypeLabel: dayProfile?.type.label || "",
    dayLowCapacity: Boolean(dayProfile?.lowCapacity),
  };
}

function sortByScore(left, right) {
  return right.score - left.score || left.estimatedMinutes - right.estimatedMinutes;
}

function applyFrogs(tasks, selectedDate) {
  const next = tasks.map((task) => ({ ...task, frogDay: false, frogWeek: false }));
  const dayCandidates = next
    .filter((task) => task.gtdDecision === "Executar" && task.scheduledDate === selectedDate)
    .sort((left, right) => right.score + right.effort * 4 - (left.score + left.effort * 4));
  const weekCandidates = next
    .filter((task) => task.gtdDecision === "Executar" && task.scheduledDate)
    .sort((left, right) => right.score + right.impact * 3 - (left.score + left.impact * 3));

  const dayFrog = next.find((task) => task.frog === "day" || task.frog === "both") || dayCandidates[0];
  const weekFrog = next.find((task) => task.frog === "week" || task.frog === "both") || weekCandidates[0];

  if (dayFrog) {
    dayFrog.frogDay = true;
  }

  if (weekFrog) {
    weekFrog.frogWeek = true;
  }

  next.forEach((task) => {
    task.frogLabel = task.frogDay && task.frogWeek
      ? "Sapo do dia e da semana"
      : task.frogDay
        ? "Sapo do dia"
        : task.frogWeek
          ? "Sapo da semana"
          : "";
  });

  return next;
}
function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseDateTimeDate(value) {
  return String(value || "").slice(0, 10);
}

function parseDateTimeMinutes(value) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function buildTimeline(state, daySnapshot) {
  const usage = { morning: 0, afternoon: 0, night: 0 };
  const events = [];

  state.blocks
    .filter((block) => block.date === daySnapshot.date)
    .forEach((block) => {
      events.push({
        id: block.id,
        title: block.title,
        startTime: block.startTime,
        endTime: block.endTime,
        period: block.period || "afternoon",
        kind: block.kind,
        source: "internal",
      });
    });

  state.calendar.externalBusyBlocks
    .filter((block) => parseDateTimeDate(block.start) === daySnapshot.date)
    .forEach((block) => {
      events.push({
        id: block.id,
        title: block.title,
        startTime: minutesToTime(parseDateTimeMinutes(block.start)),
        endTime: minutesToTime(parseDateTimeMinutes(block.end)),
        period: "external",
        kind: "external",
        source: "google",
      });
    });

  daySnapshot.tasks.forEach((task) => {
    const period = task.scheduledPeriod || "afternoon";
    const periodInfo = PERIODS.find((entry) => entry.id === period) || PERIODS[1];
    const startMinute = periodInfo.startMinute + usage[period];
    const endMinute = startMinute + task.estimatedMinutes;
    usage[period] += task.estimatedMinutes + 10;

    events.push({
      id: `task-${task.id}`,
      title: task.title,
      startTime: minutesToTime(startMinute),
      endTime: minutesToTime(endMinute),
      period,
      kind: task.type,
      source: "task",
      critical: task.critical,
    });
  });

  return events.sort((left, right) => {
    const leftMinutes = Number(left.startTime.split(":")[0]) * 60 + Number(left.startTime.split(":")[1]);
    const rightMinutes = Number(right.startTime.split(":")[0]) * 60 + Number(right.startTime.split(":")[1]);
    return leftMinutes - rightMinutes;
  });
}

function buildDaySnapshot(state, tasks, date) {
  const profile = resolveDayProfile(state, date);
  const dayTasks = tasks
    .filter((task) => task.scheduledDate === date)
    .sort(sortByScore);
  const periodMap = Object.fromEntries(
    profile.periods.map((period) => [period.id, { ...period, load: 0, tasks: [] }]),
  );

  dayTasks.forEach((task) => {
    const periodId = task.scheduledPeriod || "afternoon";
    const target = periodMap[periodId] || periodMap.afternoon;
    target.load += task.estimatedMinutes;
    target.tasks.push(task);
  });

  const periods = Object.values(periodMap).map((period) => ({
    ...period,
    overload: period.load > period.capacity,
  }));
  const totalLoad = periods.reduce((sum, period) => sum + period.load, 0);

  return {
    ...profile,
    tasks: dayTasks,
    periods,
    totalLoad,
    overload: totalLoad > profile.totalCapacity,
    alerts: dayTasks.filter((task) => task.manualDecision || task.location === "alert").length,
    timeline: buildTimeline(state, { ...profile, date, tasks: dayTasks }),
  };
}

function matchesScope(task, scope) {
  if (scope === "work") {
    return task.area?.type === "work";
  }

  if (scope === "personal") {
    return task.area?.type !== "work";
  }

  return true;
}

function matchesFilters(task, filters) {
  return (
    matchesScope(task, filters.scope) &&
    (filters.areaId === "all" || task.areaId === filters.areaId) &&
    (filters.projectId === "all" || task.projectId === filters.projectId) &&
    (filters.context === "all" || task.context === filters.context) &&
    (filters.dayTypeId === "all" || task.dayTypeId === filters.dayTypeId)
  );
}

function buildWeekData(state, tasks, selectedDate) {
  const dates = getWeekDates(selectedDate);
  const days = dates.map((date) => buildDaySnapshot(state, tasks, date));

  return {
    dates,
    days,
    totalLoad: days.reduce((sum, day) => sum + day.totalLoad, 0),
    totalCapacity: days.reduce((sum, day) => sum + day.totalCapacity, 0),
  };
}

function buildAreaSummaries(state, tasks) {
  return state.areas.map((area) => {
    const areaTasks = tasks.filter((task) => task.areaId === area.id);
    return {
      ...area,
      openCount: areaTasks.length,
      priorityCount: areaTasks.filter((task) => task.score >= 80).length,
      alerts: areaTasks.filter((task) => task.manualDecision || task.location === "alert").length,
      nextTasks: areaTasks.slice(0, 3),
    };
  });
}

function buildProjectSummaries(state, tasks) {
  return state.projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    return {
      ...project,
      openCount: projectTasks.length,
      progress: clamp(
        Math.round(projectTasks.filter((task) => task.status === "done").length * 100 / Math.max(1, projectTasks.length)),
        0,
        100,
      ),
      nextTasks: projectTasks.slice(0, 3),
    };
  });
}

function buildDashboardModel(state, tasks, selectedDate, weekData) {
  const currentSprint = state.sprints.find((sprint) => sprint.status === "current") || null;
  const sprintObjectives = currentSprint
    ? state.objectives.filter((objective) => currentSprint.objectiveIds.includes(objective.id))
    : [];
  const sprintProgress = sprintObjectives.length
    ? Math.round(sprintObjectives.reduce((sum, objective) => sum + toNumber(objective.progress, 0), 0) / sprintObjectives.length)
    : 0;
  const moveDeadline = state.profile.moveDeadline || selectedDate;
  const weekOverload = weekData.days.filter((day) => day.overload).length;

  return {
    currentSprint: currentSprint
      ? { title: currentSprint.title, progress: sprintProgress, theme: currentSprint.theme }
      : null,
    weekProgress: {
      done: state.tasks.filter((task) => task.status === "done" && weekData.dates.includes(task.scheduledDate)).length,
      total: state.tasks.filter((task) => task.scheduledDate && weekData.dates.includes(task.scheduledDate) && !isTemplateTask(task)).length,
      percent: clamp(
        Math.round(
          state.tasks.filter((task) => task.status === "done" && weekData.dates.includes(task.scheduledDate)).length * 100 /
          Math.max(1, state.tasks.filter((task) => task.scheduledDate && weekData.dates.includes(task.scheduledDate) && !isTemplateTask(task)).length),
        ),
        0,
        100,
      ),
    },
    energyLabel: getWeekEnergyLabel(state.weeklyPlan.energyLevel),
    daysToMove: differenceInDays(moveDeadline, selectedDate),
    mainGoals: state.objectives.slice(0, 4),
    radar: weekOverload > 0 ? { label: "Ajustar carga" } : { label: "Semana sob controle" },
    alerts: tasks.filter((task) => task.manualDecision || task.location === "alert").slice(0, 4),
    areaSummaries: buildAreaSummaries(state, tasks),
    projectSummaries: buildProjectSummaries(state, tasks),
    load: {
      total: weekData.totalLoad,
      capacity: weekData.totalCapacity,
      days: weekData.days,
    },
  };
}

function buildPrioritizeModel(tasks, selectedDate) {
  const ranked = [...tasks].sort(sortByScore);
  const stageMap = new Map();

  ranked.forEach((task) => {
    const key = task.gtdDecision;
    if (!stageMap.has(key)) {
      stageMap.set(key, []);
    }
    stageMap.get(key).push(task);
  });

  return {
    ranked: ranked.slice(0, 12),
    dayFrog: ranked.find((task) => task.frogDay) || null,
    weekFrog: ranked.find((task) => task.frogWeek) || null,
    stages: [
      "Processar",
      "Executar",
      "Agendar",
      "Delegar",
      "Aguardar",
      "Backlog",
      "Projeto",
      "Descartar",
    ].map((decision) => ({
      decision,
      tasks: (stageMap.get(decision) || []).slice(0, 4),
      count: (stageMap.get(decision) || []).length,
    })),
    summary: {
      today: ranked.filter((task) => task.scheduledDate === selectedDate && task.score >= 80).slice(0, 4),
      simplify: ranked.filter((task) => task.suggestions.includes("quebrar em partes menores")).slice(0, 4),
      delegate: ranked.filter((task) => task.suggestions.includes("avaliar delegacao")).slice(0, 4),
    },
  };
}

function buildOrganizeModel(tasks) {
  return ORGANIZE_BUCKETS.map((bucket) => ({
    ...bucket,
    tasks: tasks.filter((task) => task.finalBucket === bucket.id).slice(0, 8),
  }));
}

function buildRoutineModel(state, tasks, selectedDate, weekData) {
  const habitProgress = state.habits.map((habit) => {
    const done = (habit.logs || []).filter((log) => log.done && weekData.dates.includes(log.date)).length;
    return {
      ...habit,
      done,
      percent: clamp(Math.round(done * 100 / Math.max(1, habit.targetPerWeek)), 0, 100),
    };
  });

  return {
    morning: [...(state.routines.morning || [])].sort((left, right) => left.order - right.order),
    night: [...(state.routines.night || [])].sort((left, right) => left.order - right.order),
    habits: habitProgress,
    healthTasks: tasks.filter((task) => task.areaId === "area-health" && weekData.dates.includes(task.scheduledDate)).slice(0, 6),
    selectedDate,
  };
}

function buildPlanningModel(state, tasks) {
  return {
    currentSprint: state.sprints.find((sprint) => sprint.status === "current") || null,
    upcomingSprint: state.sprints.find((sprint) => sprint.status === "upcoming") || null,
    objectives: state.objectives,
    backlog: tasks.filter((task) => task.location === "backlog" || task.finalBucket === "backlog").slice(0, 10),
    templates: state.tasks.filter((task) => isTemplateTask(task)).slice(0, 10),
  };
}

function buildSettingsModel(state) {
  return {
    editMode: state.settings.editMode,
    visualDensity: state.settings.visualDensity,
    accentTone: state.settings.accentTone,
    reasoningLine: state.settings.reasoningLine,
    prioritization: state.settings.prioritization,
    layouts: state.settings.layouts,
    layoutDefaults: state.settings.layoutDefaults,
    layoutMode: state.settings.layoutMode,
    layoutCapabilities: state.settings.layoutCapabilities,
    architecture: state.settings.architecture,
  };
}

function blankEntity(kind, state) {
  if (kind === "task") {
    return {
      id: "",
      title: "",
      subtasks: [],
      areaId: state.areas[0]?.id || "",
      projectId: "",
      objectiveId: "",
      sprintId: "",
      type: "task",
      context: "flex",
      scheduledPeriod: "afternoon",
      status: "todo",
      location: "scheduled",
      scheduledDate: state.ui.selectedDate,
      dueDate: state.ui.selectedDate,
      estimatedMinutes: 30,
      priority: "medium",
      impact: 3,
      urgency: 3,
      effort: 3,
      energyCost: 2,
      nextAction: "",
      gtdStage: "clarify",
      gtdDecision: "Executar",
      finalBucket: "priority",
      frog: "",
      scoreAdjustment: 0,
      notes: "",
      isRecurring: false,
      isTemplate: false,
      delegable: false,
      critical: false,
      manualDecision: false,
      riskAccepted: false,
    };
  }

  if (kind === "area") {
    return { id: "", name: "", type: "life", color: "#8f7a62", description: "" };
  }

  if (kind === "project") {
    return { id: "", name: "", areaId: "area-work", status: "active", color: "#8b6c50", summary: "" };
  }

  if (kind === "objective") {
    return { id: "", title: "", areaId: state.areas[0]?.id || "", projectId: "", progress: 0, dueDate: state.ui.selectedDate, description: "" };
  }

  if (kind === "habit") {
    return { id: "", title: "", areaId: "area-health", targetPerWeek: 3, preferredWeekdays: [], note: "", logs: [] };
  }

  if (kind === "block") {
    return { id: "", title: "", areaId: state.areas[0]?.id || "", projectId: "", date: state.ui.selectedDate, startTime: "09:00", endTime: "10:00", period: "afternoon", kind: "routine", note: "" };
  }

  if (kind === "routine") {
    return { id: "", title: "", period: "morning", areaId: "area-routine", order: 1, active: true, recurring: true, note: "" };
  }

  return { id: "", date: state.ui.selectedDate, typeId: getDefaultDayTypeId(state, state.ui.selectedDate), periods: defaultPeriodsForType(state, getDefaultDayTypeId(state, state.ui.selectedDate)), note: "" };
}

function buildEditorView(state) {
  const { kind, id } = state.ui.editor;

  if (!kind) {
    return null;
  }

  const entity = (() => {
    if (!id || id.startsWith("new-")) {
      return blankEntity(kind, state);
    }

    if (kind === "task") return getTaskById(state, id) || blankEntity(kind, state);
    if (kind === "area") return state.areas.find((entry) => entry.id === id) || blankEntity(kind, state);
    if (kind === "project") return state.projects.find((entry) => entry.id === id) || blankEntity(kind, state);
    if (kind === "objective") return state.objectives.find((entry) => entry.id === id) || blankEntity(kind, state);
    if (kind === "habit") return state.habits.find((entry) => entry.id === id) || blankEntity(kind, state);
    if (kind === "block") return state.blocks.find((entry) => entry.id === id) || blankEntity(kind, state);
    if (kind === "routine") {
      return [...(state.routines.morning || []), ...(state.routines.night || [])].find((entry) => entry.id === id) || blankEntity(kind, state);
    }
    return state.dayOverrides.find((entry) => entry.id === id) || blankEntity(kind, state);
  })();

  return { kind, entity };
}

export function buildAppModel(inputState, referenceDate = new Date()) {
  const state = prepareState(cloneValue(inputState));
  const today = formatISODate(referenceDate);
  const selectedDate = state.ui.selectedDate || today;
  const enrichedTasks = applyFrogs(
    state.tasks.filter(isOpenTask).map((task) => enrichTask(task, state, selectedDate)),
    selectedDate,
  );
  const filteredTasks = enrichedTasks.filter((task) => matchesFilters(task, state.ui.filters));
  const weekData = buildWeekData(state, filteredTasks, selectedDate);
  const selectedDay = weekData.days.find((day) => day.date === selectedDate) || buildDaySnapshot(state, filteredTasks, selectedDate);
  const dashboard = buildDashboardModel(state, filteredTasks, selectedDate, weekData);
  const prioritize = buildPrioritizeModel(filteredTasks, selectedDate);
  const organize = buildOrganizeModel(filteredTasks);
  const inbox = filteredTasks.filter((task) => task.location === "inbox");
  const settings = buildSettingsModel(state);
  const floatingAlert = selectedDay.tasks.find(
    (task) => task.critical && !task.riskAccepted && (task.manualDecision || selectedDay.lowCapacity || task.location === "alert"),
  ) || null;

  return {
    today,
    activeSection: state.ui.activeSection,
    selectedDate,
    priorityMethod: state.ui.priorityMethod,
    editMode: state.settings.editMode,
    filters: state.ui.filters,
    week: weekData,
    selectedDay,
    filteredTasks,
    dashboard,
    prioritize,
    organize,
    inbox,
    areas: buildAreaSummaries(state, filteredTasks),
    projects: buildProjectSummaries(state, filteredTasks),
    routine: buildRoutineModel(state, filteredTasks, selectedDate, weekData),
    planning: buildPlanningModel(state, filteredTasks),
    agenda: {
      days: weekData.days,
      connected: state.calendar.connected,
      google: state.settings.googleCalendar,
    },
    settings,
    editorView: buildEditorView(state),
    floatingAlert,
    options: {
      areas: state.areas,
      projects: state.projects,
      objectives: state.objectives,
      sprints: state.sprints,
      dayTypes: state.dayTypes,
      periods: PERIODS,
      methods: Object.entries(METHOD_LABELS).map(([id, label]) => ({ id, label, guide: METHOD_GUIDES[id] })),
      buckets: ORGANIZE_BUCKETS,
      taskTypes: TASK_TYPES,
      contexts: TASK_CONTEXTS,
      scopes: [
        { id: "integrated", label: "Integrado" },
        { id: "personal", label: "Foco pessoal" },
        { id: "work", label: "Foco trabalho" },
      ],
    },
  };
}
function normalizeTaskPayload(state, payload = {}, existing = null) {
  const areaId = payload.areaId || existing?.areaId || state.areas[0]?.id || "";
  const area = getAreaById(state, areaId);
  const projectId = area?.type === "work" ? payload.projectId || existing?.projectId || "" : "";
  const scheduledDate = payload.scheduledDate || existing?.scheduledDate || "";
  const isTemplate = toBoolean(payload.isTemplate, existing?.isTemplate || false);
  const location = payload.location || existing?.location || (isTemplate ? "template" : scheduledDate ? "scheduled" : "inbox");
  const status = payload.status || existing?.status || (location === "inbox" ? "inbox" : "todo");

  return {
    id: payload.id || existing?.id || makeId("task"),
    title: String(payload.title || existing?.title || "Nova tarefa").trim(),
    subtasks: parseSubtasks(payload.subtasks, existing?.subtasks || []),
    areaId,
    projectId,
    objectiveId: payload.objectiveId || existing?.objectiveId || "",
    sprintId: payload.sprintId || existing?.sprintId || "",
    type: payload.type || existing?.type || "task",
    context: payload.context || existing?.context || "flex",
    scheduledPeriod: payload.scheduledPeriod || existing?.scheduledPeriod || guessPeriod(payload),
    status: isTemplate ? "template" : status,
    location: isTemplate ? "template" : location,
    scheduledDate: location === "inbox" || location === "backlog" ? "" : scheduledDate,
    dueDate: payload.dueDate || existing?.dueDate || scheduledDate || "",
    estimatedMinutes: toNumber(payload.estimatedMinutes, existing?.estimatedMinutes || 30),
    priority: payload.priority || existing?.priority || "medium",
    impact: toNumber(payload.impact, existing?.impact || 3),
    urgency: toNumber(payload.urgency, existing?.urgency || 3),
    effort: toNumber(payload.effort, existing?.effort || 3),
    energyCost: toNumber(payload.energyCost, existing?.energyCost || 2),
    nextAction: payload.nextAction || existing?.nextAction || "",
    gtdStage: payload.gtdStage || existing?.gtdStage || "clarify",
    gtdDecision: payload.gtdDecision || existing?.gtdDecision || "Executar",
    finalBucket: payload.finalBucket || existing?.finalBucket || "priority",
    frog: payload.frog || existing?.frog || "",
    scoreAdjustment: toNumber(payload.scoreAdjustment, existing?.scoreAdjustment || 0),
    notes: payload.notes || existing?.notes || "",
    isRecurring: toBoolean(payload.isRecurring, existing?.isRecurring || false),
    isTemplate,
    delegable: toBoolean(payload.delegable, existing?.delegable || false),
    critical: toBoolean(payload.critical, existing?.critical || false),
    manualDecision: toBoolean(payload.manualDecision, existing?.manualDecision || false),
    riskAccepted: toBoolean(payload.riskAccepted, existing?.riskAccepted || false),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
    completedAt: existing?.completedAt || "",
    source: existing?.source || payload.source || "manual",
    lastAction: payload.lastAction || existing?.lastAction || "",
  };
}

function normalizeAreaPayload(payload = {}, existing = null) {
  return {
    id: payload.id || existing?.id || makeId("area"),
    name: String(payload.name || existing?.name || "Nova area").trim(),
    type: payload.type || existing?.type || "life",
    color: payload.color || existing?.color || "#8f7a62",
    description: payload.description || existing?.description || "",
  };
}

function normalizeProjectPayload(payload = {}, existing = null) {
  return {
    id: payload.id || existing?.id || makeId("project"),
    name: String(payload.name || existing?.name || "Novo projeto").trim(),
    areaId: payload.areaId || existing?.areaId || "area-work",
    status: payload.status || existing?.status || "active",
    color: payload.color || existing?.color || "#8b6c50",
    summary: payload.summary || existing?.summary || "",
  };
}

function normalizeObjectivePayload(payload = {}, existing = null) {
  return {
    id: payload.id || existing?.id || makeId("objective"),
    title: String(payload.title || existing?.title || "Novo objetivo").trim(),
    areaId: payload.areaId || existing?.areaId || "",
    projectId: payload.projectId || existing?.projectId || "",
    progress: toNumber(payload.progress, existing?.progress || 0),
    dueDate: payload.dueDate || existing?.dueDate || "",
    description: payload.description || existing?.description || "",
  };
}

function normalizeHabitPayload(payload = {}, existing = null) {
  return {
    id: payload.id || existing?.id || makeId("habit"),
    title: String(payload.title || existing?.title || "Novo habito").trim(),
    areaId: payload.areaId || existing?.areaId || "area-health",
    targetPerWeek: toNumber(payload.targetPerWeek, existing?.targetPerWeek || 3),
    preferredWeekdays: typeof payload.preferredWeekdays === "string"
      ? payload.preferredWeekdays.split(",").map((item) => item.trim()).filter(Boolean)
      : payload.preferredWeekdays || existing?.preferredWeekdays || [],
    logs: existing?.logs || [],
    note: payload.note || existing?.note || "",
  };
}

function normalizeBlockPayload(payload = {}, existing = null) {
  return {
    id: payload.id || existing?.id || makeId("block"),
    title: String(payload.title || existing?.title || "Novo bloco").trim(),
    areaId: payload.areaId || existing?.areaId || "",
    projectId: payload.projectId || existing?.projectId || "",
    date: payload.date || existing?.date || formatISODate(new Date()),
    startTime: payload.startTime || existing?.startTime || "09:00",
    endTime: payload.endTime || existing?.endTime || "10:00",
    period: payload.period || existing?.period || "afternoon",
    kind: payload.kind || existing?.kind || "routine",
    fixed: toBoolean(payload.fixed, existing?.fixed !== false),
    note: payload.note || existing?.note || "",
    source: existing?.source || payload.source || "manual",
  };
}

function normalizeRoutinePayload(payload = {}, existing = null) {
  return {
    id: payload.id || existing?.id || makeId("routine"),
    title: String(payload.title || existing?.title || "Novo item").trim(),
    period: payload.period || existing?.period || "morning",
    areaId: payload.areaId || existing?.areaId || "area-routine",
    order: toNumber(payload.order, existing?.order || 1),
    active: toBoolean(payload.active, existing?.active !== false),
    recurring: toBoolean(payload.recurring, existing?.recurring !== false),
    note: payload.note || existing?.note || "",
  };
}

function normalizeDayOverridePayload(state, payload = {}, existing = null) {
  const typeId = payload.typeId || existing?.typeId || getDefaultDayTypeId(state, payload.date || existing?.date || formatISODate(new Date()));
  return {
    id: payload.id || existing?.id || makeId("override"),
    date: payload.date || existing?.date || formatISODate(new Date()),
    typeId,
    periods: {
      ...defaultPeriodsForType(state, typeId),
      ...(existing?.periods || {}),
      ...(payload.periods || {}),
    },
    note: payload.note || existing?.note || "",
    lastPlan: existing?.lastPlan || null,
  };
}

function setRoutineItem(state, item) {
  state.routines.morning = (state.routines.morning || []).filter((entry) => entry.id !== item.id);
  state.routines.night = (state.routines.night || []).filter((entry) => entry.id !== item.id);
  if (item.period === "night") {
    state.routines.night.push(item);
  } else {
    state.routines.morning.push(item);
  }
}

function removeRoutineItem(state, id) {
  state.routines.morning = (state.routines.morning || []).filter((entry) => entry.id !== id);
  state.routines.night = (state.routines.night || []).filter((entry) => entry.id !== id);
}

function pickPeriodForTask(task, state, date, usage = null) {
  const profile = resolveDayProfile(state, date);
  const currentUsage = usage || Object.fromEntries(profile.periods.map((period) => [period.id, 0]));
  const preferred = guessPeriod(task);
  const ordered = [preferred, ...PERIODS.map((period) => period.id).filter((id) => id !== preferred)];

  for (const periodId of ordered) {
    const period = profile.periods.find((entry) => entry.id === periodId);
    if (period && currentUsage[periodId] + task.estimatedMinutes <= period.capacity) {
      return periodId;
    }
  }

  return "";
}

function findNextUsefulSlot(task, state, fromDate) {
  for (let step = 1; step <= 14; step += 1) {
    const date = formatISODate(addDays(fromDate, step));
    const profile = resolveDayProfile(state, date);

    if (task.type === "health" && !["segunda", "terca", "quinta", "sabado"].includes(getWeekdayKey(date))) {
      continue;
    }

    if (task.context === "deep-work" && profile.lowCapacity && !task.critical) {
      continue;
    }

    const slot = pickPeriodForTask(task, state, date);
    if (slot) {
      return { date, period: slot };
    }
  }

  return { date: fromDate, period: guessPeriod(task) };
}

function rebalanceDay(state, date) {
  const profile = resolveDayProfile(state, date);
  const enriched = applyFrogs(
    state.tasks.filter((task) => isOpenTask(task) && task.scheduledDate === date).map((task) => enrichTask(task, state, date)),
    date,
  ).sort(sortByScore);
  const usage = Object.fromEntries(profile.periods.map((period) => [period.id, 0]));
  let movedCount = 0;
  let alertCount = 0;
  let reviewCount = 0;

  enriched.forEach((ranked) => {
    const task = getTaskById(state, ranked.id);
    const slot = pickPeriodForTask(task, state, date, usage);

    if (slot) {
      task.scheduledPeriod = slot;
      usage[slot] += task.estimatedMinutes;
      if (!task.critical) {
        task.manualDecision = false;
      }
      if (task.location === "alert" || task.location === "review") {
        task.location = "scheduled";
      }
      return;
    }

    if (task.critical || task.priority === "high" || (task.dueDate && differenceInDays(task.dueDate, date) <= 0)) {
      task.location = "alert";
      task.manualDecision = true;
      alertCount += 1;
      return;
    }

    if (task.delegable || toNumber(task.effort, 3) >= 4 || toNumber(task.estimatedMinutes, 30) >= 90) {
      task.location = "review";
      task.manualDecision = true;
      reviewCount += 1;
      return;
    }

    const nextSlot = findNextUsefulSlot(task, state, date);
    if (nextSlot.date !== date) {
      task.previousScheduledDate = date;
      task.scheduledDate = nextSlot.date;
      task.scheduledPeriod = nextSlot.period;
      task.location = "scheduled";
      task.manualDecision = false;
      task.lastAction = "auto-moved";
      movedCount += 1;
    }
  });

  const override = getDayOverride(state, date);
  if (override) {
    override.lastPlan = { movedCount, alertCount, reviewCount, at: nowIso() };
  }

  return { movedCount, alertCount, reviewCount };
}

function setTaskFrog(state, taskId, mode) {
  state.tasks.forEach((task) => {
    if (mode === "day" && (task.frog === "day" || task.frog === "both")) {
      task.frog = task.frog === "both" ? "week" : "";
    }
    if (mode === "week" && (task.frog === "week" || task.frog === "both")) {
      task.frog = task.frog === "both" ? "day" : "";
    }
  });

  const task = getTaskById(state, taskId);
  if (!task) {
    return;
  }

  if (mode === "clear") {
    task.frog = "";
    return;
  }

  if (mode === "day") {
    task.frog = task.frog === "week" ? "both" : "day";
  }

  if (mode === "week") {
    task.frog = task.frog === "day" ? "both" : "week";
  }
}

export function setActiveSection(state, section) {
  const nextState = cloneState(state);
  nextState.ui.activeSection = section;
  return nextState;
}

export function setSelectedDate(state, date) {
  const nextState = cloneState(state);
  nextState.ui.selectedDate = date;
  return nextState;
}

export function setFilter(state, name, value) {
  const nextState = cloneState(state);
  nextState.ui.filters[name] = value;
  return nextState;
}

export function clearFilters(state) {
  const nextState = cloneState(state);
  nextState.ui.filters = { ...DEFAULT_FILTERS };
  return nextState;
}

export function setPriorityMethod(state, method) {
  const nextState = cloneState(state);
  nextState.ui.priorityMethod = method;
  pushHistory(nextState, "priority-method", `Metodo de prioridade alterado para ${method}.`);
  return nextState;
}

export function setWeeklyEnergy(state, level) {
  const nextState = cloneState(state);
  nextState.weeklyPlan.energyLevel = toNumber(level, 3);
  pushHistory(nextState, "weekly-energy", `Energia semanal definida como ${getWeekEnergyLabel(level)}.`);
  return nextState;
}

export function toggleHabitForDate(state, habitId, date) {
  const nextState = cloneState(state);
  const habit = nextState.habits.find((entry) => entry.id === habitId);
  if (!habit) return nextState;
  const existing = (habit.logs || []).find((entry) => entry.date === date);
  if (existing) existing.done = !existing.done;
  else {
    habit.logs = habit.logs || [];
    habit.logs.push({ date, done: true });
  }
  pushHistory(nextState, "habit-toggle", `Habito atualizado: ${habit.title}`);
  return nextState;
}

export function addInboxTask(state, payload) {
  const nextState = cloneState(state);
  const task = normalizeTaskPayload(nextState, { ...payload, location: "inbox", status: "inbox", source: "capture" }, null);
  nextState.tasks.unshift(task);
  pushHistory(nextState, "task-captured", `Nova tarefa capturada: ${task.title}`);
  return nextState;
}

export function applyTaskAction(state, taskId, action, _meta = {}, referenceDate = formatISODate(new Date())) {
  const nextState = cloneState(state);
  const task = getTaskById(nextState, taskId);
  if (!task) return nextState;

  if (action === "complete") {
    task.status = "done";
    task.location = "done";
    task.completedAt = nowIso();
    task.manualDecision = false;
  }

  if (action === "today" || action === "resolve-now") {
    task.status = "todo";
    task.location = "scheduled";
    task.scheduledDate = referenceDate;
    task.scheduledPeriod = guessPeriod(task);
    task.manualDecision = false;
    task.riskAccepted = false;
  }

  if (action === "backlog") {
    task.status = "backlog";
    task.location = "backlog";
    task.scheduledDate = "";
    task.manualDecision = false;
  }

  if (action === "inbox") {
    task.status = "inbox";
    task.location = "inbox";
    task.scheduledDate = "";
    task.manualDecision = false;
  }

  if (action === "delegate") {
    task.status = "delegated";
    task.location = "delegated";
    task.manualDecision = false;
  }

  if (action === "waiting") {
    task.status = "waiting";
    task.location = "waiting";
    task.manualDecision = false;
  }

  if (action === "discard") {
    task.status = "discarded";
    task.location = "discarded";
    task.manualDecision = false;
  }

  if (action === "auto-defer") {
    const slot = findNextUsefulSlot(task, nextState, task.scheduledDate || referenceDate);
    task.previousScheduledDate = task.scheduledDate || referenceDate;
    task.scheduledDate = slot.date;
    task.scheduledPeriod = slot.period;
    task.location = "scheduled";
    task.manualDecision = false;
  }

  if (action === "keep-original") {
    task.location = "scheduled";
    task.manualDecision = false;
  }

  if (action === "accept-risk") {
    task.location = "scheduled";
    task.manualDecision = false;
    task.riskAccepted = true;
  }

  if (action === "mark-frog-day") {
    setTaskFrog(nextState, taskId, "day");
  }

  if (action === "mark-frog-week") {
    setTaskFrog(nextState, taskId, "week");
  }

  if (action === "clear-frog") {
    setTaskFrog(nextState, taskId, "clear");
  }

  if (action === "reprocess") {
    task.gtdStage = "clarify";
    task.gtdDecision = "Executar";
    task.nextAction = "";
    task.finalBucket = "priority";
    task.scoreAdjustment = 0;
    task.manualDecision = false;
  }

  if (action === "as-template") {
    task.isTemplate = true;
    task.status = "template";
    task.location = "template";
    task.scheduledDate = "";
    task.dueDate = "";
  }

  if (action === "instantiate-template" && isTemplateTask(task)) {
    const newTask = normalizeTaskPayload(nextState, { ...task, id: "", isTemplate: false, location: "inbox", status: "inbox", scheduledDate: "", dueDate: "" }, null);
    nextState.tasks.unshift(newTask);
  }

  task.updatedAt = nowIso();
  pushHistory(nextState, "task-action", `Tarefa atualizada: ${task.title}`, { action });
  return nextState;
}

export function openEditor(state, kind, id = "") {
  const nextState = cloneState(state);
  nextState.ui.editor = { kind, id: id || `new-${kind}` };
  return nextState;
}

export function closeEditor(state) {
  const nextState = cloneState(state);
  nextState.ui.editor = { kind: "", id: "" };
  return nextState;
}

export function saveEntity(state, kind, payload) {
  const nextState = cloneState(state);

  if (kind === "task") {
    const existing = payload.id ? getTaskById(nextState, payload.id) : null;
    const task = normalizeTaskPayload(nextState, payload, existing);
    nextState.tasks = nextState.tasks.filter((entry) => entry.id !== task.id);
    nextState.tasks.unshift(task);
  }

  if (kind === "area") {
    const existing = nextState.areas.find((entry) => entry.id === payload.id) || null;
    const area = normalizeAreaPayload(payload, existing);
    nextState.areas = nextState.areas.filter((entry) => entry.id !== area.id);
    nextState.areas.push(area);
  }

  if (kind === "project") {
    const existing = nextState.projects.find((entry) => entry.id === payload.id) || null;
    const project = normalizeProjectPayload(payload, existing);
    nextState.projects = nextState.projects.filter((entry) => entry.id !== project.id);
    nextState.projects.push(project);
  }

  if (kind === "objective") {
    const existing = nextState.objectives.find((entry) => entry.id === payload.id) || null;
    const objective = normalizeObjectivePayload(payload, existing);
    nextState.objectives = nextState.objectives.filter((entry) => entry.id !== objective.id);
    nextState.objectives.push(objective);
  }

  if (kind === "habit") {
    const existing = nextState.habits.find((entry) => entry.id === payload.id) || null;
    const habit = normalizeHabitPayload(payload, existing);
    nextState.habits = nextState.habits.filter((entry) => entry.id !== habit.id);
    nextState.habits.push(habit);
  }

  if (kind === "block") {
    const existing = nextState.blocks.find((entry) => entry.id === payload.id) || null;
    const item = normalizeBlockPayload(payload, existing);
    nextState.blocks = nextState.blocks.filter((entry) => entry.id !== item.id);
    nextState.blocks.push(item);
  }

  if (kind === "routine") {
    const existing = [...(nextState.routines.morning || []), ...(nextState.routines.night || [])].find((entry) => entry.id === payload.id) || null;
    setRoutineItem(nextState, normalizeRoutinePayload(payload, existing));
  }

  if (kind === "day-override") {
    const existing = nextState.dayOverrides.find((entry) => entry.id === payload.id) || null;
    const override = normalizeDayOverridePayload(nextState, payload, existing);
    nextState.dayOverrides = nextState.dayOverrides.filter((entry) => entry.id !== override.id);
    nextState.dayOverrides.push(override);
  }

  nextState.ui.editor = { kind: "", id: "" };
  pushHistory(nextState, "save-entity", `Item salvo: ${kind}`);
  return nextState;
}

export function deleteEntity(state, kind, id) {
  const nextState = cloneState(state);
  if (kind === "task") nextState.tasks = nextState.tasks.filter((entry) => entry.id !== id);
  if (kind === "area") nextState.areas = nextState.areas.filter((entry) => entry.id !== id);
  if (kind === "project") nextState.projects = nextState.projects.filter((entry) => entry.id !== id);
  if (kind === "objective") nextState.objectives = nextState.objectives.filter((entry) => entry.id !== id);
  if (kind === "habit") nextState.habits = nextState.habits.filter((entry) => entry.id !== id);
  if (kind === "block") nextState.blocks = nextState.blocks.filter((entry) => entry.id !== id);
  if (kind === "routine") removeRoutineItem(nextState, id);
  if (kind === "day-override") nextState.dayOverrides = nextState.dayOverrides.filter((entry) => entry.id !== id);
  nextState.ui.editor = { kind: "", id: "" };
  pushHistory(nextState, "delete-entity", `Item removido: ${kind}`);
  return nextState;
}

export function duplicateEntity(state, kind, id) {
  const nextState = cloneState(state);
  if (kind === "task") {
    const existing = getTaskById(nextState, id);
    if (existing) nextState.tasks.unshift(normalizeTaskPayload(nextState, { ...existing, id: "", title: `${existing.title} (copia)` }, null));
  }
  if (kind === "block") {
    const existing = nextState.blocks.find((entry) => entry.id === id);
    if (existing) nextState.blocks.push(normalizeBlockPayload({ ...existing, id: "", title: `${existing.title} (copia)` }, null));
  }
  if (kind === "routine") {
    const existing = [...(nextState.routines.morning || []), ...(nextState.routines.night || [])].find((entry) => entry.id === id);
    if (existing) setRoutineItem(nextState, normalizeRoutinePayload({ ...existing, id: "", title: `${existing.title} (copia)` }, null));
  }
  pushHistory(nextState, "duplicate-entity", `Item duplicado: ${kind}`);
  return nextState;
}

export function setDayType(state, date, typeId) {
  const nextState = cloneState(state);
  const existing = getDayOverride(nextState, date);
  const payload = normalizeDayOverridePayload(nextState, { ...(existing || {}), date, typeId, periods: defaultPeriodsForType(nextState, typeId) }, existing);
  nextState.dayOverrides = nextState.dayOverrides.filter((entry) => entry.id !== payload.id);
  nextState.dayOverrides.push(payload);
  const result = rebalanceDay(nextState, date);
  pushHistory(nextState, "day-type", `Tipo de dia alterado para ${getDayTypeById(nextState, typeId)?.label || typeId}.`);
  return { nextState, ...result };
}

export function setDayPeriodType(state, date, periodId, typeId) {
  const nextState = cloneState(state);
  const existing = getDayOverride(nextState, date);
  const payload = normalizeDayOverridePayload(nextState, { ...(existing || {}), date, typeId: existing?.typeId || getDefaultDayTypeId(nextState, date), periods: { ...(existing?.periods || defaultPeriodsForType(nextState, existing?.typeId || getDefaultDayTypeId(nextState, date))), [periodId]: typeId } }, existing);
  nextState.dayOverrides = nextState.dayOverrides.filter((entry) => entry.id !== payload.id);
  nextState.dayOverrides.push(payload);
  const result = rebalanceDay(nextState, date);
  pushHistory(nextState, "day-period", `Periodo ${periodId} ajustado.`);
  return { nextState, ...result };
}

export function replanWeek(state, referenceDate = formatISODate(new Date())) {
  const nextState = cloneState(state);
  let movedCount = 0;
  let alertCount = 0;
  let reviewCount = 0;

  nextState.tasks.forEach((task) => {
    if (isOpenTask(task) && task.scheduledDate && differenceInDays(task.scheduledDate, referenceDate) < 0 && !task.critical) {
      const slot = findNextUsefulSlot(task, nextState, referenceDate);
      task.previousScheduledDate = task.scheduledDate;
      task.scheduledDate = slot.date;
      task.scheduledPeriod = slot.period;
      task.location = "scheduled";
      task.manualDecision = false;
      movedCount += 1;
    }
  });

  getWeekDates(referenceDate).forEach((date) => {
    const result = rebalanceDay(nextState, date);
    movedCount += result.movedCount;
    alertCount += result.alertCount;
    reviewCount += result.reviewCount;
  });

  pushHistory(nextState, "replan-week", `Semana reorganizada: ${movedCount} movidas, ${alertCount} alertas e ${reviewCount} revisoes.`);
  return { nextState, movedCount, alertCount, reviewCount };
}

export function toggleEditMode(state) {
  const nextState = cloneState(state);
  nextState.settings.editMode = !nextState.settings.editMode;
  pushHistory(nextState, "edit-mode", `Modo edicao ${nextState.settings.editMode ? "ativado" : "desativado"}.`);
  return nextState;
}

export function saveSettings(state, payload) {
  const nextState = cloneState(state);
  nextState.settings.visualDensity = payload.visualDensity || nextState.settings.visualDensity;
  nextState.settings.accentTone = payload.accentTone || nextState.settings.accentTone;
  nextState.settings.reasoningLine = payload.reasoningLine || nextState.settings.reasoningLine;
  nextState.settings.prioritization = {
    healthProtection: toNumber(payload.healthProtection, nextState.settings.prioritization.healthProtection),
    moveProtection: toNumber(payload.moveProtection, nextState.settings.prioritization.moveProtection),
    familyProtection: toNumber(payload.familyProtection, nextState.settings.prioritization.familyProtection),
    futureFocus: toNumber(payload.futureFocus, nextState.settings.prioritization.futureFocus),
    delegationBias: toNumber(payload.delegationBias, nextState.settings.prioritization.delegationBias),
    overloadLimit: toNumber(payload.overloadLimit, nextState.settings.prioritization.overloadLimit),
  };
  pushHistory(nextState, "settings", "Configuracoes atualizadas.");
  return nextState;
}

export function saveCurrentLayoutAsDefault(state) {
  const nextState = cloneState(state);
  nextState.settings.layoutDefaults = cloneLayouts(nextState.settings.layouts);
  pushHistory(nextState, "layout-default", "Layout atual salvo como padrao.");
  return nextState;
}

export function restoreLayoutDefault(state) {
  const nextState = cloneState(state);
  nextState.settings.layouts = cloneLayouts(nextState.settings.layoutDefaults || DEFAULT_LAYOUTS);
  pushHistory(nextState, "layout-restore", "Layout padrao restaurado.");
  return nextState;
}

export function moveLayoutCard(state, page, cardId, targetId) {
  const nextState = cloneState(state);
  const cards = [...(nextState.settings.layouts[page] || [])];
  const fromIndex = cards.findIndex((entry) => entry.id === cardId);
  const toIndex = cards.findIndex((entry) => entry.id === targetId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return nextState;
  const [entry] = cards.splice(fromIndex, 1);
  cards.splice(toIndex, 0, entry);
  nextState.settings.layouts[page] = cards;
  pushHistory(nextState, "layout-move", `Card movido em ${page}: ${cardId}.`);
  return nextState;
}

export function resizeLayoutCard(state, page, cardId, dimension, direction) {
  const nextState = cloneState(state);
  const entry = nextState.settings.layouts[page]?.find((item) => item.id === cardId);
  if (!entry) return nextState;

  if (dimension === "width") {
    entry.width = stepLayoutValue(entry.width, LAYOUT_WIDTH_ORDER, direction, "medium");
  }

  if (dimension === "height") {
    entry.height = stepLayoutValue(entry.height, LAYOUT_HEIGHT_ORDER, direction, "regular");
  }

  pushHistory(nextState, "layout-resize", `Card redimensionado em ${page}: ${cardId}.`, { dimension, direction });
  return nextState;
}

export function saveGoogleCalendarConfig(state, config) {
  const nextState = cloneState(state);
  nextState.settings.googleCalendar = {
    clientId: config.clientId || "",
    apiKey: config.apiKey || "",
    calendarId: config.calendarId || "primary",
  };
  nextState.calendar.calendarId = nextState.settings.googleCalendar.calendarId;
  return nextState;
}

export function setCalendarConnected(state, connected) {
  const nextState = cloneState(state);
  nextState.calendar.connected = connected;
  return nextState;
}

export function applyGoogleBusyBlocks(state, blocks) {
  const nextState = cloneState(state);
  nextState.calendar.externalBusyBlocks = blocks;
  nextState.calendar.connected = true;
  pushHistory(nextState, "calendar-sync", `${blocks.length} bloco(s) sincronizado(s) do Google Calendar.`);
  return nextState;
}

export function getInternalBlockDateTime(block) {
  return {
    start: createLocalDateTime(block.date, block.startTime),
    end: createLocalDateTime(block.date, block.endTime),
  };
}


