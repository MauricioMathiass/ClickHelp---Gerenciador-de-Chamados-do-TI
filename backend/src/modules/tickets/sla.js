// Cálculo de SLA em horas úteis, a partir do "calendário" configurado pela
// empresa (expediente, dias úteis e feriados). Usa o fuso horário do
// processo (variável TZ do .env, padrão America/Sao_Paulo).

const NATIONAL_HOLIDAYS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

// Feriados móveis opcionais, em dias a partir do domingo de Páscoa.
export const MOVABLE_HOLIDAYS = {
  carnaval: { label: "Carnaval (segunda e terça)", offsets: [-48, -47] },
  "corpus-christi": { label: "Corpus Christi", offsets: [60] },
};

export const DEFAULT_CALENDAR = {
  workStartHour: 8,
  workEndHour: 18,
  workDays: [1, 2, 3, 4, 5],
  holidays: { national: true, movable: [], extra: [] },
};

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

const offsetFromEaster = (year, days) => {
  const date = calculateEasterSunday(year);
  date.setDate(date.getDate() + days);
  return formatMonthDay(date);
};

/** Datas (MM-DD) que não são dias úteis no ano, conforme a configuração de feriados. */
const getHolidayKeys = (year, holidays) => {
  const keys = new Set(holidays.extra ?? []);

  if (holidays.national) {
    NATIONAL_HOLIDAYS.forEach((key) => keys.add(key));
    keys.add(offsetFromEaster(year, -2)); // Sexta-feira Santa
  }

  (holidays.movable ?? []).forEach((name) => {
    (MOVABLE_HOLIDAYS[name]?.offsets ?? []).forEach((offset) => keys.add(offsetFromEaster(year, offset)));
  });

  return keys;
};

/** Cria o calendário de trabalho usado no SLA e nas rotinas. */
export const createCalendar = (settings = DEFAULT_CALENDAR) => {
  const workStartHour = settings.workStartHour ?? DEFAULT_CALENDAR.workStartHour;
  const workEndHour = settings.workEndHour ?? DEFAULT_CALENDAR.workEndHour;
  const workDays = new Set(settings.workDays ?? DEFAULT_CALENDAR.workDays);
  const holidays = settings.holidays ?? DEFAULT_CALENDAR.holidays;
  const holidayCache = new Map();

  const isHoliday = (date) => {
    const year = date.getFullYear();

    if (!holidayCache.has(year)) {
      holidayCache.set(year, getHolidayKeys(year, holidays));
    }

    return holidayCache.get(year).has(formatMonthDay(date));
  };

  return {
    workStartHour,
    workEndHour,
    isHoliday,
    isBusinessDay: (date) => workDays.has(date.getDay()) && !isHoliday(date),
  };
};

const moveToNextBusinessDayStart = (date, calendar) => {
  const nextDate = new Date(date);

  do {
    nextDate.setDate(nextDate.getDate() + 1);
  } while (!calendar.isBusinessDay(nextDate));

  nextDate.setHours(calendar.workStartHour, 0, 0, 0);
  return nextDate;
};

const normalizeToBusinessWindow = (date, calendar) => {
  const normalized = new Date(date);

  if (!calendar.isBusinessDay(normalized)) {
    return moveToNextBusinessDayStart(new Date(normalized.setHours(0, 0, 0, 0) - 1), calendar);
  }

  const hour = normalized.getHours();

  if (hour < calendar.workStartHour) {
    normalized.setHours(calendar.workStartHour, 0, 0, 0);
    return normalized;
  }

  if (hour >= calendar.workEndHour) {
    return moveToNextBusinessDayStart(normalized, calendar);
  }

  return normalized;
};

/** Data limite (ISO) do SLA: `hours` horas úteis a partir de `baseDateInput`. */
export const buildSlaLimitFromDate = (baseDateInput, hours, calendar = createCalendar()) => {
  let current = normalizeToBusinessWindow(new Date(baseDateInput), calendar);
  let remainingHours = hours;

  while (remainingHours > 0) {
    const endOfWorkday = new Date(current);
    endOfWorkday.setHours(calendar.workEndHour, 0, 0, 0);

    const availableHoursToday = (endOfWorkday.getTime() - current.getTime()) / (1000 * 60 * 60);

    if (remainingHours <= availableHoursToday) {
      current = new Date(current.getTime() + remainingHours * 60 * 60 * 1000);
      break;
    }

    remainingHours -= availableHoursToday;
    current = moveToNextBusinessDayStart(current, calendar);
  }

  return current.toISOString();
};
