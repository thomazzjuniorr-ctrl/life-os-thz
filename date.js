const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_KEYS = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
];

function pad(value) {
  return String(value).padStart(2, "0");
}

export function parseISODate(value) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function formatISODate(value) {
  const date = value instanceof Date ? value : parseISODate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(value, amount) {
  const date = parseISODate(value);
  date.setDate(date.getDate() + amount);
  return date;
}

export function startOfWeek(value) {
  const date = parseISODate(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

export function endOfWeek(value) {
  return addDays(startOfWeek(value), 6);
}

export function getWeekDates(value) {
  const start = startOfWeek(value);
  return Array.from({ length: 7 }, (_, index) =>
    formatISODate(addDays(start, index)),
  );
}

export function differenceInDays(left, right) {
  return Math.round(
    (parseISODate(left).getTime() - parseISODate(right).getTime()) / DAY_MS,
  );
}

export function isBeforeDate(left, right) {
  return parseISODate(left).getTime() < parseISODate(right).getTime();
}

export function getWeekdayKey(value) {
  return WEEKDAY_KEYS[parseISODate(value).getDay()];
}

export function formatLongDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(parseISODate(value));
}

export function formatShortDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(parseISODate(value));
}

export function formatWeekday(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
  }).format(parseISODate(value));
}

export function getMonthLabel(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(parseISODate(value));
}

export function getQuarterLabel(value) {
  const date = parseISODate(value);
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
}

export function createLocalDateTime(dateLike, time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  const date = parseISODate(dateLike);
  date.setHours(hours || 0, minutes || 0, 0, 0);

  return `${formatISODate(date)}T${pad(hours || 0)}:${pad(minutes || 0)}:00`;
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
