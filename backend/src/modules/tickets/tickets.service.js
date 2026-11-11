import crypto from "node:crypto";
import { badRequest, notFound } from "../../shared/http/httpError.js";
import { ROLE_ADMIN, TI_ROLES } from "../../shared/roles.js";
import { createNotification } from "../notifications/notifications.service.js";
import { getSettings, getWorkCalendar, PRIORITIES } from "../settings/settings.service.js";
import { buildSlaLimitFromDate } from "./sla.js";
import {
  ADMIN_ONLY_VISIBILITY,
  STATUS_ABERTO,
  STATUS_EM_ANDAMENTO,
  STATUS_FECHADO,
  ticketsStore as store,
  VALID_STATUSES,
} from "./tickets.store.js";

const MAX_ASSUNTO = 150;
const MAX_LOCAL = 60;
const MAX_PROBLEMA = 5000;
const MAX_RESPOSTA = 5000;

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

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

/** Aceita só valores da lista configurada (quando a lista não está vazia). */
const pickFromList = (value, list, label, { required }) => {
  const text = String(value ?? "").trim();

  if (!list.length) {
    return text.slice(0, MAX_LOCAL);
  }

  const match = list.find((item) => item.toLowerCase() === text.toLowerCase());

  if (!match && (required || text)) {
    throw badRequest(`Selecione um(a) ${label} válido(a).`);
  }

  return match ?? "";
};

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
  const chamados = await store.read();
  return sortByNewest(chamados.filter((item) => canSeeChamado(item, user)));
};

export const createChamado = async (data, user) => {
  const settings = await getSettings();
  const assunto = requireText(data.assunto, "assunto", MAX_ASSUNTO);
  const problema = requireText(data.problema, "problema", MAX_PROBLEMA);
  const local = pickFromList(data.local, settings.catalog.locations, "local", { required: true });
  const categoria = pickFromList(data.categoria, settings.catalog.categories, "categoria", {
    required: true,
  });
  const prioridade = normalizeText(data.prioridade);

  if (!local) {
    throw badRequest("Preencha todos os campos obrigatórios antes de enviar.");
  }

  if (!PRIORITIES.includes(prioridade)) {
    throw badRequest("Selecione uma prioridade válida.");
  }

  const now = new Date().toISOString();
  const calendar = await getWorkCalendar();
  const chamado = {
    id: crypto.randomUUID(),
    assunto,
    solicitante: user.username,
    local,
    categoria,
    prioridade,
    problema,
    userId: user.id,
    status: STATUS_ABERTO,
    resposta: "",
    dataCriacao: now,
    dataAtualizacao: now,
    dataLimite: buildSlaLimitFromDate(now, settings.sla.hoursByPriority[prioridade], calendar),
  };

  await store.update((items) => ({ items: [chamado, ...items], result: null }));

  await notifySafely({
    type: "solicitacao-enviada",
    title: "Solicitação enviada",
    message: `Seu chamado "${assunto}" foi registrado com sucesso no ${settings.branding.appName}.`,
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
    const nextResposta = hasResposta ? data.resposta.trim() : (current.resposta ?? "");
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
      delete next.autoClosed;
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
