// Regras de SLA: 48 horas úteis, de segunda a sexta, das 8h às 18h,
// desconsiderando feriados nacionais. Usa o fuso horário do processo
// (definido em src/config.js, padrão America/Sao_Paulo).
//
// Feriados opcionais (configuráveis no .env):
// - SLA_FERIADOS_MOVEIS=carnaval,corpus-christi  (datas calculadas a partir da Páscoa)
// - SLA_FERIADOS_EXTRAS=01-25,07-09              (datas fixas extras, formato MM-DD)

export const WORK_START_HOUR = 8;
export const WORK_END_HOUR = 18;
export const SLA_BUSINESS_HOURS = 48;

const FIXED_NATIONAL_HOLIDAYS = new Set([
  "01-01",
  "04-21",
  "05-01",
  "09-07",
  "10-12",
  "11-02",
  "11-15",
  "11-20",
  "12-25",
]);

export const formatMonthDay = (date) =>
  `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const formatDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const calculateEasterSunday = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
};

const parseList = (value) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const offsetFromEaster = (year, days) => {
  const date = calculateEasterSunday(year);
  date.setDate(date.getDate() + days);
  return formatMonthDay(date);
};

// Feriados móveis opcionais, em dias a partir do domingo de Páscoa.
const OPTIONAL_MOVABLE_HOLIDAYS = {
  carnaval: [-48, -47], // segunda e terça de Carnaval
  "corpus-christi": [60],
};

/** Datas (MM-DD) que não são dias úteis no ano informado. */
const getHolidayKeys = (year) => {
  const keys = new Set(FIXED_NATIONAL_HOLIDAYS);
  keys.add(offsetFromEaster(year, -2)); // Sexta-feira Santa

  parseList(process.env.SLA_FERIADOS_MOVEIS).forEach((name) => {
    (OPTIONAL_MOVABLE_HOLIDAYS[name] ?? []).forEach((offset) => keys.add(offsetFromEaster(year, offset)));
  });

  parseList(process.env.SLA_FERIADOS_EXTRAS)
    .filter((item) => /^\d{2}-\d{2}$/.test(item))
    .forEach((item) => keys.add(item));

  return keys;
};

export const isNationalHoliday = (date) => getHolidayKeys(date.getFullYear()).has(formatMonthDay(date));

export const isBusinessDay = (date) => {
  const day = date.getDay();
  return day >= 1 && day <= 5 && !isNationalHoliday(date);
};

const moveToNextBusinessDayStart = (date) => {
  const nextDate = new Date(date);

  do {
    nextDate.setDate(nextDate.getDate() + 1);
  } while (!isBusinessDay(nextDate));

  nextDate.setHours(WORK_START_HOUR, 0, 0, 0);
  return nextDate;
};

const normalizeToBusinessWindow = (date) => {
  const normalized = new Date(date);

  if (!isBusinessDay(normalized)) {
    while (!isBusinessDay(normalized)) {
      normalized.setDate(normalized.getDate() + 1);
    }

    normalized.setHours(WORK_START_HOUR, 0, 0, 0);
    return normalized;
  }

  const hour = normalized.getHours();

  if (hour < WORK_START_HOUR) {
    normalized.setHours(WORK_START_HOUR, 0, 0, 0);
    return normalized;
  }

  if (hour >= WORK_END_HOUR) {
    return moveToNextBusinessDayStart(normalized);
  }

  return normalized;
};

/** Data limite (ISO) do SLA a partir da data de abertura. */
export const buildSlaLimitFromDate = (baseDateInput) => {
  let current = normalizeToBusinessWindow(new Date(baseDateInput));
  let remainingHours = SLA_BUSINESS_HOURS;

  while (remainingHours > 0) {
    const endOfWorkday = new Date(current);
    endOfWorkday.setHours(WORK_END_HOUR, 0, 0, 0);

    const availableHoursToday = (endOfWorkday.getTime() - current.getTime()) / (1000 * 60 * 60);

    if (remainingHours <= availableHoursToday) {
      current = new Date(current.getTime() + remainingHours * 60 * 60 * 1000);
      break;
    }

    remainingHours -= availableHoursToday;
    current = moveToNextBusinessDayStart(current);
  }

  return current.toISOString();
};
