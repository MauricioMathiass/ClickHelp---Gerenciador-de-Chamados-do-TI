import crypto from "node:crypto";
import { badRequest, notFound } from "../lib/httpError.js";
import { createJsonStore } from "../lib/jsonStore.js";
import { ROLE_ADMIN, TI_ROLES } from "../lib/roles.js";
import { buildSlaLimitFromDate, formatDateKey, isBusinessDay } from "../lib/sla.js";
import { createNotification } from "./notificationService.js";

const store = createJsonStore("chamadosStore.json");

export const STATUS_ABERTO = "Aberto";
export const STATUS_EM_ANDAMENTO = "Em andamento";
export const STATUS_FECHADO = "Fechado";
export const VALID_STATUSES = [STATUS_ABERTO, STATUS_EM_ANDAMENTO, STATUS_FECHADO];
export const VALID_PRIORIDADES = ["baixa", "media", "alta"];

const MAX_ASSUNTO = 150;
const MAX_LOCAL = 60;
const MAX_PROBLEMA = 5000;
const MAX_RESPOSTA = 5000;

const FIXED_ROUTINE_START_HOUR = 7;
const FIXED_ROUTINE_START_MINUTE = 30;
const ADMIN_ONLY_VISIBILITY = "admin-only";
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

/**
 * Cria a notificação sem derrubar a operação principal: se o chamado já foi
 * salvo e só o aviso falhou, a resposta continua sendo de sucesso (evita que
 * o usuário reenvie e duplique o chamado).
 */
const notifySafely = async (notification) => {
  try {
    await createNotification(notification);
  } catch (error) {
    console.error("[ClickHELP] Falha ao criar notificação:", error);
  }
};

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const requireText = (value, label, maxLength) => {
  const text = String(value ?? "").trim();

  if (!text) {
    throw badRequest("Preencha todos os campos obrigatórios antes de enviar.");
  }

  if (text.length > maxLength) {
    throw badRequest(`O campo ${label} aceita no máximo ${maxLength} caracteres.`);
  }

  return text;
};

const buildFixedRoutineLaunchDate = (date) => {
  const launchDate = new Date(date);
  launchDate.setHours(FIXED_ROUTINE_START_HOUR, FIXED_ROUTINE_START_MINUTE, 0, 0);
  return launchDate;
};

const createFixedChamado = (template, referenceDate) => {
  const launchDateIso = buildFixedRoutineLaunchDate(referenceDate).toISOString();

  return {
    id: crypto.randomUUID(),
    assunto: template.assunto,
    solicitante: "Admin",
    local: template.local,
    prioridade: template.prioridade,
    problema: template.problema,
    userId: null,
    status: STATUS_ABERTO,
    resposta: "",
    dataCriacao: launchDateIso,
    dataAtualizacao: launchDateIso,
    dataLimite: buildSlaLimitFromDate(launchDateIso),
    visibility: ADMIN_ONLY_VISIBILITY,
    isFixedRoutine: true,
    fixedRoutineCode: template.code,
    fixedRoutineDateKey: formatDateKey(referenceDate),
  };
};

export const AUTO_CLOSE_MESSAGE = "Encerrada automaticamente: rotina diária de um dia anterior.";

/**
 * Mantém as rotinas fixas do admin:
 * - encerra automaticamente as rotinas de dias anteriores que ficaram abertas
 *   (para não se acumularem no Painel TI);
 * - cria as rotinas do dia (uma vez por dia útil, a partir das 7h30).
 * É chamada ao listar chamados e também periodicamente pelo servidor.
 */
export const ensureFixedDailyChamados = (now = new Date()) =>
  store.update((items) => {
    const dateKey = formatDateKey(now);
    let changed = false;

    let nextItems = items.map((item) => {
      if (!item.isFixedRoutine || item.status === STATUS_FECHADO || item.fixedRoutineDateKey >= dateKey) {
        return item;
      }

      changed = true;
      return {
        ...item,
        status: STATUS_FECHADO,
        resposta: item.resposta || AUTO_CLOSE_MESSAGE,
        dataAtualizacao: now.toISOString(),
        dataFechamento: now.toISOString(),
        autoClosed: true,
      };
    });

    if (isBusinessDay(now) && now >= buildFixedRoutineLaunchDate(now)) {
      const missing = FIXED_ADMIN_REQUESTS.filter(
        (template) =>
          !nextItems.some(
            (item) =>
              item.isFixedRoutine &&
              item.fixedRoutineCode === template.code &&
              item.fixedRoutineDateKey === dateKey
          )
      ).map((template) => createFixedChamado(template, now));

      if (missing.length) {
        changed = true;
        nextItems = [...missing, ...nextItems];
      }
    }

    return { items: changed ? nextItems : null, result: null };
  });

const canSeeChamado = (chamado, user) => {
  if (chamado.visibility === ADMIN_ONLY_VISIBILITY) {
    return user.role === ROLE_ADMIN;
  }

  if (TI_ROLES.includes(user.role)) {
    return true;
  }

  return normalizeText(chamado.solicitante) === normalizeText(user.username);
};

const sortByNewest = (items) =>
  [...items].sort((first, second) => new Date(second.dataCriacao) - new Date(first.dataCriacao));

/** Lista os chamados que o usuário autenticado pode ver. */
export const listChamados = async (user) => {
  await ensureFixedDailyChamados();
  const chamados = await store.read();
  return sortByNewest(chamados.filter((item) => canSeeChamado(item, user)));
};

export const createChamado = async (data, user) => {
  const assunto = requireText(data.assunto, "assunto", MAX_ASSUNTO);
  const local = requireText(data.local, "local", MAX_LOCAL);
  const problema = requireText(data.problema, "problema", MAX_PROBLEMA);
  const prioridade = normalizeText(data.prioridade);

  if (!VALID_PRIORIDADES.includes(prioridade)) {
    throw badRequest("Selecione uma prioridade válida.");
  }

  const now = new Date().toISOString();
  const chamado = {
    id: crypto.randomUUID(),
    assunto,
    solicitante: user.username,
    local,
    prioridade,
    problema,
    userId: user.id,
    status: STATUS_ABERTO,
    resposta: "",
    dataCriacao: now,
    dataAtualizacao: now,
    dataLimite: buildSlaLimitFromDate(now),
  };

  await store.update((items) => ({ items: [chamado, ...items], result: null }));

  await notifySafely({
    type: "solicitacao-enviada",
    title: "Solicitação enviada",
    message: `Seu chamado "${assunto}" foi registrado com sucesso no ClickHELP.`,
    recipients: { usernames: [user.username] },
    context: { chamadoId: chamado.id },
  });

  await notifySafely({
    type: "novo-chamado-ti",
    title: "Nova solicitação recebida",
    message: `${user.username} abriu o chamado "${assunto}" e aguarda atendimento da equipe de TI.`,
    recipients: { roles: TI_ROLES, excludeUsernames: [user.username] },
    context: { chamadoId: chamado.id },
  });

  return chamado;
};

/**
 * Atualiza status e/ou resposta de um chamado. Só os campos `status` e
 * `resposta` são aceitos; datas de fechamento, responsável e SLA são
 * calculados aqui no servidor.
 */
export const updateChamado = async (id, data, user) => {
  const hasStatus = data.status !== undefined;
  const hasResposta = data.resposta !== undefined;

  if (!hasStatus && !hasResposta) {
    throw badRequest("Informe o status ou a resposta do chamado.");
  }

  if (hasStatus && !VALID_STATUSES.includes(data.status)) {
    throw badRequest("Status inválido.");
  }

  if (hasResposta && typeof data.resposta !== "string") {
    throw badRequest("Resposta inválida.");
  }

  if (hasResposta && data.resposta.length > MAX_RESPOSTA) {
    throw badRequest(`A resposta aceita no máximo ${MAX_RESPOSTA} caracteres.`);
  }

  const { previous, updated } = await store.update((items) => {
    const index = items.findIndex((item) => item.id === id);

    if (index === -1 || !canSeeChamado(items[index], user)) {
      throw notFound("Chamado não encontrado.");
    }

    const current = items[index];
    const nextStatus = hasStatus ? data.status : current.status;
    const nextResposta = hasResposta ? data.resposta.trim() : current.resposta ?? "";
    const now = new Date();
    const next = {
      ...current,
      status: nextStatus,
      resposta: nextResposta,
      dataAtualizacao: now.toISOString(),
    };

    // Chamado fechado precisa sempre ter resposta (ao fechar e ao editar depois).
    if (nextStatus === STATUS_FECHADO && !nextResposta) {
      throw badRequest("Escreva a resposta da TI antes de fechar o chamado.");
    }

    if (nextStatus === STATUS_FECHADO && current.status !== STATUS_FECHADO) {

      next.dataFechamento = now.toISOString();
      next.closedByUsername = user.username;
      next.closedByName = user.name;
      next.closedByRole = user.role;
      next.slaViolado = current.dataLimite ? new Date(current.dataLimite) < now : false;
    }

    if (nextStatus !== STATUS_FECHADO && current.status === STATUS_FECHADO) {
      delete next.dataFechamento;
      delete next.closedByUsername;
      delete next.closedByName;
      delete next.closedByRole;
      delete next.slaViolado;
    }

    const nextItems = [...items];
    nextItems[index] = next;
    return { items: nextItems, result: { previous: current, updated: next } };
  });

  const statusChanged = previous.status !== updated.status;

  if (
    statusChanged &&
    [STATUS_EM_ANDAMENTO, STATUS_FECHADO].includes(updated.status) &&
    !updated.isFixedRoutine
  ) {
    await notifySafely({
      type: "status-chamado-atualizado",
      title: `Chamado ${updated.status === STATUS_FECHADO ? "fechado" : "em andamento"}`,
      message: `Sua solicitação "${updated.assunto}" foi atualizada para "${updated.status}".`,
      recipients: { usernames: [updated.solicitante] },
      context: { chamadoId: updated.id, status: updated.status },
    });
  }

  return updated;
};
