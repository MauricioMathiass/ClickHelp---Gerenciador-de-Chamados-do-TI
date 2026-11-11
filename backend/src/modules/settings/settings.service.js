import crypto from "node:crypto";
import { badRequest } from "../../shared/http/httpError.js";
import { createJsonStore } from "../../shared/storage/jsonStore.js";
import { createCalendar, MOVABLE_HOLIDAYS } from "../tickets/sla.js";
import { DEFAULT_SETTINGS } from "./settings.defaults.js";

const store = createJsonStore("settings.json", { kind: "object" });

export const PRIORITIES = ["baixa", "media", "alta"];
export const ROUTINE_FREQUENCIES = ["daily", "weekly", "monthly"];

const MAX_LIST_ITEMS = 100;
const MAX_ROUTINES = 50;
const MAX_LOGO_LENGTH = 400 * 1024; // ~300 KB de imagem em base64
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const MONTH_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const LOGO_DATA_URL = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[a-z0-9+/=]+$/i;

let cache = null;

const clone = (value) => JSON.parse(JSON.stringify(value));

// ---------- normalização / validação ----------

const text = (value, label, { max = 80, required = false } = {}) => {
  const result = String(value ?? "").trim();

  if (required && !result) {
    throw badRequest(`Preencha o campo "${label}".`);
  }

  if (result.length > max) {
    throw badRequest(`O campo "${label}" aceita no máximo ${max} caracteres.`);
  }

  return result;
};

const uniqueTextList = (value, label) => {
  if (!Array.isArray(value)) {
    throw badRequest(`A lista "${label}" é inválida.`);
  }

  const seen = new Set();
  const result = [];

  value.forEach((item) => {
    const entry = text(item, label, { max: 60 });
    const key = entry.toLowerCase();

    if (entry && !seen.has(key)) {
      seen.add(key);
      result.push(entry);
    }
  });

  if (result.length > MAX_LIST_ITEMS) {
    throw badRequest(`A lista "${label}" aceita no máximo ${MAX_LIST_ITEMS} itens.`);
  }

  return result;
};

const integer = (value, label, min, max) => {
  const number = Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw badRequest(`"${label}" deve ser um número inteiro entre ${min} e ${max}.`);
  }

  return number;
};

const weekdayList = (value, label) => {
  if (!Array.isArray(value)) {
    throw badRequest(`"${label}" é inválido.`);
  }

  return Array.from(new Set(value.map((day) => integer(day, label, 0, 6)))).sort();
};

const normalizeBranding = (branding = {}) => {
  const primaryColor = String(branding.primaryColor ?? DEFAULT_SETTINGS.branding.primaryColor);
  const secondaryColor = String(branding.secondaryColor ?? DEFAULT_SETTINGS.branding.secondaryColor);
  const logoDataUrl = String(branding.logoDataUrl ?? "");

  if (!HEX_COLOR.test(primaryColor) || !HEX_COLOR.test(secondaryColor)) {
    throw badRequest("As cores devem estar no formato #RRGGBB.");
  }

  if (logoDataUrl && (logoDataUrl.length > MAX_LOGO_LENGTH || !LOGO_DATA_URL.test(logoDataUrl))) {
    throw badRequest("O logo deve ser uma imagem PNG, JPG, WEBP ou SVG de até 300 KB.");
  }

  return {
    appName: text(branding.appName, "Nome do sistema", { max: 40, required: true }),
    companyName: text(branding.companyName, "Nome da empresa", { max: 80 }),
    logoDataUrl,
    primaryColor: primaryColor.toLowerCase(),
    secondaryColor: secondaryColor.toLowerCase(),
  };
};

const normalizeSla = (sla = {}) => {
  const workStartHour = integer(sla.workStartHour, "Início do expediente", 0, 23);
  const workEndHour = integer(sla.workEndHour, "Fim do expediente", 1, 24);

  if (workEndHour <= workStartHour) {
    throw badRequest("O fim do expediente precisa ser depois do início.");
  }

  const workDays = weekdayList(sla.workDays ?? [], "Dias úteis");

  if (!workDays.length) {
    throw badRequest("Selecione pelo menos um dia útil.");
  }

  const hoursByPriority = {};
  PRIORITIES.forEach((priority) => {
    hoursByPriority[priority] = integer(
      sla.hoursByPriority?.[priority],
      `Prazo da prioridade ${priority}`,
      1,
      2000
    );
  });

  return { workStartHour, workEndHour, workDays, hoursByPriority };
};

const normalizeHolidays = (holidays = {}) => {
  const movable = Array.isArray(holidays.movable)
    ? Array.from(new Set(holidays.movable.filter((name) => name in MOVABLE_HOLIDAYS)))
    : [];
  const extra = Array.isArray(holidays.extra) ? Array.from(new Set(holidays.extra.map(String))) : [];
  const invalid = extra.find((item) => !MONTH_DAY.test(item));

  if (invalid) {
    throw badRequest(`Feriado inválido: "${invalid}". Use o formato MM-DD (ex.: 01-25).`);
  }

  return { national: holidays.national !== false, movable, extra: extra.sort() };
};

const requireSomeWeekday = (weekdays) => {
  const days = weekdayList(weekdays ?? [], "Dias da rotina");

  if (!days.length) {
    throw badRequest("Escolha pelo menos um dia da semana para a rotina semanal.");
  }

  return days;
};

const normalizeRoutine = (routine = {}, locations) => {
  const frequency = String(routine.frequency ?? "daily");
  const priority = String(routine.priority ?? "media");
  const time = String(routine.time ?? "07:30");

  if (!ROUTINE_FREQUENCIES.includes(frequency)) {
    throw badRequest("Frequência de rotina inválida.");
  }

  if (!PRIORITIES.includes(priority)) {
    throw badRequest("Prioridade de rotina inválida.");
  }

  if (!TIME.test(time)) {
    throw badRequest("Horário de rotina inválido. Use HH:MM.");
  }

  const location = text(routine.location, "Local da rotina", { max: 60 });

  if (location && locations.length && !locations.includes(location)) {
    throw badRequest(`O local "${location}" da rotina não está cadastrado.`);
  }

  const id = /^[a-z0-9-]{1,60}$/i.test(String(routine.id ?? "")) ? String(routine.id) : crypto.randomUUID();

  return {
    id,
    title: text(routine.title, "Título da rotina", { max: 150, required: true }),
    description: text(routine.description, "Descrição da rotina", { max: 500 }) || "Solicitação de rotina",
    location,
    priority,
    time,
    frequency,
    weekdays: frequency === "weekly" ? requireSomeWeekday(routine.weekdays) : [],
    monthDay: frequency === "monthly" ? integer(routine.monthDay, "Dia do mês da rotina", 1, 31) : null,
    active: routine.active !== false,
  };
};

/** Valida e normaliza a configuração completa enviada pela tela. */
export const normalizeSettings = (input = {}) => {
  const catalog = {
    locations: uniqueTextList(input.catalog?.locations ?? [], "Locais"),
    categories: uniqueTextList(input.catalog?.categories ?? [], "Categorias"),
    departments: uniqueTextList(input.catalog?.departments ?? [], "Departamentos"),
  };

  if (!Array.isArray(input.routines ?? [])) {
    throw badRequest("Lista de rotinas inválida.");
  }

  if ((input.routines ?? []).length > MAX_ROUTINES) {
    throw badRequest(`Cadastre no máximo ${MAX_ROUTINES} rotinas.`);
  }

  const routines = (input.routines ?? []).map((routine) => normalizeRoutine(routine, catalog.locations));
  const ids = new Set();
  routines.forEach((routine) => {
    if (ids.has(routine.id)) {
      routine.id = crypto.randomUUID();
    }
    ids.add(routine.id);
  });

  return {
    branding: normalizeBranding(input.branding),
    catalog,
    sla: normalizeSla(input.sla),
    holidays: normalizeHolidays(input.holidays),
    routines,
  };
};

/** Junta o que está salvo com os padrões (campos novos ganham valor padrão). */
const withDefaults = (saved) => {
  if (!saved) {
    return clone(DEFAULT_SETTINGS);
  }

  return {
    branding: { ...DEFAULT_SETTINGS.branding, ...saved.branding },
    catalog: { ...DEFAULT_SETTINGS.catalog, ...saved.catalog },
    sla: {
      ...DEFAULT_SETTINGS.sla,
      ...saved.sla,
      hoursByPriority: { ...DEFAULT_SETTINGS.sla.hoursByPriority, ...saved.sla?.hoursByPriority },
    },
    holidays: { ...DEFAULT_SETTINGS.holidays, ...saved.holidays },
    routines: Array.isArray(saved.routines) ? saved.routines : [],
  };
};

// ---------- acesso ----------

export const getSettings = async () => {
  if (!cache) {
    cache = withDefaults(await store.read());
  }

  return clone(cache);
};

/** Somente o que a tela de login precisa (sem dados internos). */
export const getPublicSettings = async () => {
  const { branding } = await getSettings();
  return { branding };
};

export const updateSettings = async (input) => {
  const next = normalizeSettings(input);

  await store.update(() => ({ items: next, result: null }));
  cache = next;
  return clone(next);
};

/** Calendário de trabalho (expediente, dias úteis e feriados) da empresa. */
export const getWorkCalendar = async () => {
  const settings = await getSettings();
  return createCalendar({ ...settings.sla, holidays: settings.holidays });
};

/** Usado pelos testes para ler de novo o arquivo de configurações. */
export const clearSettingsCache = () => {
  cache = null;
};
