import crypto from "node:crypto";
import { getSettings, getWorkCalendar } from "../settings/settings.service.js";
import { buildSlaLimitFromDate, formatDateKey } from "./sla.js";
import { ADMIN_ONLY_VISIBILITY, STATUS_ABERTO, STATUS_FECHADO, ticketsStore } from "./tickets.store.js";

export const AUTO_CLOSE_MESSAGE = "Encerrada automaticamente: uma nova ocorrência desta rotina foi aberta.";
export const ORPHAN_CLOSE_MESSAGE = "Encerrada automaticamente: a rotina foi removida ou desativada.";

const lastDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

/** A rotina deve gerar chamado nesta data? */
const isDueOn = (routine, date, calendar) => {
  switch (routine.frequency) {
    case "weekly":
      return routine.weekdays.includes(date.getDay());
    case "monthly":
      // Dia 31 em mês de 30 dias cai no último dia do mês.
      return date.getDate() === Math.min(routine.monthDay, lastDayOfMonth(date));
    default:
      return calendar.isBusinessDay(date);
  }
};

const launchDateFor = (routine, date) => {
  const [hour, minute] = routine.time.split(":").map(Number);
  const launch = new Date(date);
  launch.setHours(hour, minute, 0, 0);
  return launch;
};

const closeRoutineTicket = (item, now, message) => ({
  ...item,
  status: STATUS_FECHADO,
  resposta: item.resposta || message,
  dataAtualizacao: now.toISOString(),
  dataFechamento: now.toISOString(),
  autoClosed: true,
});

/**
 * Mantém as rotinas cadastradas nas Configurações:
 * - cria o chamado de cada rotina no dia e horário previstos (uma vez só);
 * - ao abrir uma nova ocorrência, encerra as anteriores da mesma rotina que
 *   ficaram abertas (para não se acumularem);
 * - encerra ocorrências antigas de rotinas removidas ou desativadas.
 * É chamada ao listar chamados e também periodicamente pelo servidor.
 */
export const ensureRoutineTickets = async (now = new Date()) => {
  const [settings, calendar] = await Promise.all([getSettings(), getWorkCalendar()]);
  const activeRoutines = settings.routines.filter((routine) => routine.active);
  const activeIds = new Set(activeRoutines.map((routine) => routine.id));
  const dateKey = formatDateKey(now);

  return ticketsStore.update((items) => {
    let changed = false;
    let nextItems = items;
    const created = [];

    activeRoutines.forEach((routine) => {
      const launch = launchDateFor(routine, now);

      if (!isDueOn(routine, now, calendar) || now < launch) {
        return;
      }

      const exists = nextItems.some(
        (item) =>
          item.isFixedRoutine && item.fixedRoutineCode === routine.id && item.fixedRoutineDateKey === dateKey
      );

      if (exists) {
        return;
      }

      changed = true;
      nextItems = nextItems.map((item) =>
        item.isFixedRoutine &&
        item.fixedRoutineCode === routine.id &&
        item.status !== STATUS_FECHADO &&
        item.fixedRoutineDateKey < dateKey
          ? closeRoutineTicket(item, now, AUTO_CLOSE_MESSAGE)
          : item
      );

      const launchIso = launch.toISOString();
      created.push({
        id: crypto.randomUUID(),
        assunto: routine.title,
        solicitante: "Rotina",
        local: routine.location,
        categoria: "",
        prioridade: routine.priority,
        problema: routine.description,
        userId: null,
        status: STATUS_ABERTO,
        resposta: "",
        dataCriacao: launchIso,
        dataAtualizacao: launchIso,
        dataLimite: buildSlaLimitFromDate(
          launchIso,
          settings.sla.hoursByPriority[routine.priority],
          calendar
        ),
        visibility: ADMIN_ONLY_VISIBILITY,
        isFixedRoutine: true,
        fixedRoutineCode: routine.id,
        fixedRoutineDateKey: dateKey,
      });
    });

    nextItems = nextItems.map((item) => {
      if (
        item.isFixedRoutine &&
        item.status !== STATUS_FECHADO &&
        !activeIds.has(item.fixedRoutineCode) &&
        item.fixedRoutineDateKey < dateKey
      ) {
        changed = true;
        return closeRoutineTicket(item, now, ORPHAN_CLOSE_MESSAGE);
      }

      return item;
    });

    return { items: changed ? [...created, ...nextItems] : null, result: created.length };
  });
};
