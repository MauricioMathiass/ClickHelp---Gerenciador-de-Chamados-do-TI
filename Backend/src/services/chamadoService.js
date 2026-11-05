import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.resolve(__dirname, "../data/chamadosStore.json");
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 18;
const SLA_BUSINESS_HOURS = 48;
const FIXED_ROUTINE_START_HOUR = 7;
const FIXED_ROUTINE_START_MINUTE = 30;
const ADMIN_ONLY_VISIBILITY = "admin-only";
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
const FIXED_ADMIN_REQUESTS = [
  {
    code: "backup-diario-incremental",
    assunto: "BACKUP DIARIO INCREMENTAL",
    local: "ORV-AWA",
    prioridade: "media",
    problema: "Solicitação fixa diária",
  },
  {
    code: "auditoria-biometria",
    assunto: "AUDITORIA BIOMETRIA - ORV, QUANTA, DC",
    local: "ORV",
    prioridade: "media",
    problema: "Solicitação fixa diária",
  },
  {
    code: "verificar-unidades-externas",
    assunto: "VERIFICAR UNIDADES EXTERNAS - AWA, PROSUP, REURB",
    local: "ORV",
    prioridade: "media",
    problema: "Solicitação fixa diária",
  },
  {
    code: "impressoras-ricoh",
    assunto: "DESLIGAR / LIGAR IMPRESSORAS RICOH",
    local: "ORV",
    prioridade: "media",
    problema: "Solicitação fixa diária",
  },
];

const ensureStoreFile = async () => {
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
};

const readChamados = async () => {
  await ensureStoreFile();

  try {
    const rawValue = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeChamados = async (chamados) => {
  await ensureStoreFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(chamados, null, 2), "utf8");
};

const formatMonthDay = (date) =>
  `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const calculateEasterSunday = (year) => {
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

const getDynamicNationalHolidayKeys = (year) => {
  const easterSunday = calculateEasterSunday(year);
  const goodFriday = new Date(easterSunday);
  goodFriday.setDate(easterSunday.getDate() - 2);

  return new Set([formatMonthDay(goodFriday)]);
};

const isNationalHoliday = (date) => {
  const monthDay = formatMonthDay(date);

  if (FIXED_NATIONAL_HOLIDAYS.has(monthDay)) {
    return true;
  }

  return getDynamicNationalHolidayKeys(date.getFullYear()).has(monthDay);
};

const isBusinessDay = (date) => {
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

const buildSlaLimitFromDate = (baseDateInput) => {
  let current = normalizeToBusinessWindow(new Date(baseDateInput));
  let remainingHours = SLA_BUSINESS_HOURS;

  while (remainingHours > 0) {
    const endOfWorkday = new Date(current);
    endOfWorkday.setHours(WORK_END_HOUR, 0, 0, 0);

    const availableHoursToday = (endOfWorkday.getTime() - current.getTime()) / (1000 * 60 * 60);

    if (remainingHours <= availableHoursToday) {
      current = new Date(current.getTime() + remainingHours * 60 * 60 * 1000);
      remainingHours = 0;
      break;
    }

    remainingHours -= availableHoursToday;
    current = moveToNextBusinessDayStart(current);
  }

  return current.toISOString();
};

const buildFixedRoutineLaunchDate = (date) => {
  const launchDate = new Date(date);
  launchDate.setHours(FIXED_ROUTINE_START_HOUR, FIXED_ROUTINE_START_MINUTE, 0, 0);
  return launchDate;
};

const shouldGenerateFixedDailyChamados = (referenceDate) => {
  if (!isBusinessDay(referenceDate)) {
    return false;
  }

  const launchDate = buildFixedRoutineLaunchDate(referenceDate);
  return referenceDate.getTime() >= launchDate.getTime();
};

const createFixedChamado = (template, referenceDate) => {
  const launchDate = buildFixedRoutineLaunchDate(referenceDate);
  const launchDateIso = launchDate.toISOString();

  return {
    id: crypto.randomUUID(),
    assunto: template.assunto,
    solicitante: "Admin",
    local: template.local,
    prioridade: template.prioridade,
    problema: template.problema,
    userId: null,
    status: "Aberto",
    resposta: "",
    dataCriacao: launchDateIso,
    dataAtualizacao: launchDateIso,
    dataLimite: buildSlaLimitFromDate(launchDateIso),
    visibility: ADMIN_ONLY_VISIBILITY,
    isFixedRoutine: true,
    fixedRoutineCode: template.code,
    fixedRoutineDateKey: formatDateKey(launchDate),
  };
};

const normalizeFixedChamado = (item) => {
  if (!item?.isFixedRoutine || !item.fixedRoutineCode) {
    return item;
  }

  const template = FIXED_ADMIN_REQUESTS.find((entry) => entry.code === item.fixedRoutineCode);

  if (!template) {
    return item;
  }

  return {
    ...item,
    assunto: template.assunto,
    solicitante: "Admin",
    local: template.local,
    prioridade: template.prioridade,
    problema: template.problema,
    visibility: ADMIN_ONLY_VISIBILITY,
  };
};

const ensureFixedDailyChamados = async (items) => {
  const normalizedChamados = items.map(normalizeFixedChamado);
  const hasNormalizationChanges = normalizedChamados.some((item, index) => item !== items[index]);
  const referenceDate = new Date();

  if (!shouldGenerateFixedDailyChamados(referenceDate)) {
    if (hasNormalizationChanges) {
      await writeChamados(normalizedChamados);
    }

    return normalizedChamados;
  }

  const routineDateKey = formatDateKey(referenceDate);
  const missingChamados = FIXED_ADMIN_REQUESTS.filter(
    (template) =>
      !normalizedChamados.some(
        (item) =>
          item.isFixedRoutine &&
          item.fixedRoutineCode === template.code &&
          item.fixedRoutineDateKey === routineDateKey
      )
  ).map((template) => createFixedChamado(template, referenceDate));

  if (!missingChamados.length) {
    if (hasNormalizationChanges) {
      await writeChamados(normalizedChamados);
    }

    return normalizedChamados;
  }

  const updatedChamados = [...missingChamados, ...normalizedChamados];
  await writeChamados(updatedChamados);
  return updatedChamados;
};

const sortChamadosByNewest = (items) =>
  [...items].sort((first, second) => new Date(second.dataCriacao) - new Date(first.dataCriacao));

export const listChamados = async ({ role, solicitante } = {}) => {
  const chamados = await readChamados();
  const calledWithFixedRoutines = await ensureFixedDailyChamados(chamados);
  const visibleChamados = calledWithFixedRoutines.filter(
    (item) => item.visibility !== ADMIN_ONLY_VISIBILITY || role === "Administrador"
  );

  const filteredChamados = solicitante
    ? visibleChamados.filter((item) => normalizeText(item.solicitante) === normalizeText(solicitante))
    : visibleChamados;

  return sortChamadosByNewest(filteredChamados);
};

export const createChamado = async ({
  assunto,
  solicitante,
  local,
  prioridade,
  problema,
  userId = null,
}) => {
  const trimmedAssunto = String(assunto ?? "").trim();
  const trimmedSolicitante = String(solicitante ?? "").trim();
  const trimmedLocal = String(local ?? "").trim();
  const trimmedPrioridade = String(prioridade ?? "").trim();
  const trimmedProblema = String(problema ?? "").trim();

  if (!trimmedAssunto || !trimmedSolicitante || !trimmedLocal || !trimmedPrioridade || !trimmedProblema) {
    throw new Error("Preencha todos os campos obrigatorios antes de enviar.");
  }

  const chamados = await readChamados();
  const now = new Date().toISOString();
  const chamado = {
    id: crypto.randomUUID(),
    assunto: trimmedAssunto,
    solicitante: trimmedSolicitante,
    local: trimmedLocal,
    prioridade: trimmedPrioridade,
    problema: trimmedProblema,
    userId,
    status: "Aberto",
    resposta: "",
    dataCriacao: now,
    dataAtualizacao: now,
    dataLimite: buildSlaLimitFromDate(now),
  };

  chamados.unshift(chamado);
  await writeChamados(chamados);
  return chamado;
};

export const updateChamado = async (id, updates = {}) => {
  const chamados = await readChamados();
  const chamadoIndex = chamados.findIndex((item) => item.id === id);

  if (chamadoIndex === -1) {
    return null;
  }

  const updatedChamado = {
    ...chamados[chamadoIndex],
    ...updates,
    dataAtualizacao: new Date().toISOString(),
  };

  chamados[chamadoIndex] = updatedChamado;
  await writeChamados(chamados);
  return updatedChamado;
};
