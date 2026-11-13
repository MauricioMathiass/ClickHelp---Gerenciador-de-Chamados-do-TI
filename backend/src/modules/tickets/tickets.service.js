import crypto from "node:crypto";
import { query, toIso, transaction } from "../../shared/db/database.js";
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
  VALID_STATUSES,
} from "./tickets.constants.js";

const MAX_ASSUNTO = 150;
const MAX_LOCAL = 60;
const MAX_PROBLEMA = 5000;
const MAX_RESPOSTA = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

/** Linha do banco → chamado da API (campos de fechamento só quando existem). */
const fromRow = (row) => {
  const chamado = {
    id: row.id,
    assunto: row.assunto,
    solicitante: row.solicitante,
    local: row.local,
    categoria: row.categoria,
    prioridade: row.prioridade,
    problema: row.problema,
    userId: row.user_id,
    status: row.status,
    resposta: row.resposta,
    dataCriacao: toIso(row.data_criacao),
    dataAtualizacao: toIso(row.data_atualizacao),
    dataLimite: toIso(row.data_limite),
  };

  const optional = {
    visibility: row.visibility,
    dataFechamento: toIso(row.data_fechamento),
    closedByUsername: row.closed_by_username,
    closedByName: row.closed_by_name,
    closedByRole: row.closed_by_role,
    slaViolado: row.sla_violado,
    autoClosed: row.auto_closed,
  };

  Object.entries(optional).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      chamado[key] = value;
    }
  });

  return chamado;
};

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

/** Lista os chamados que o usuário autenticado pode ver (mais novos primeiro). */
export const listChamados = async (user) => {
  if (user.role === ROLE_ADMIN) {
    return (await query("SELECT * FROM chamados ORDER BY data_criacao DESC")).map(fromRow);
  }

  const visibleToTeam = "visibility IS DISTINCT FROM $1";

  if (TI_ROLES.includes(user.role)) {
    const rows = await query(`SELECT * FROM chamados WHERE ${visibleToTeam} ORDER BY data_criacao DESC`, [
      ADMIN_ONLY_VISIBILITY,
    ]);
    return rows.map(fromRow);
  }

  const rows = await query(
    `SELECT * FROM chamados
     WHERE ${visibleToTeam} AND LOWER(solicitante) = $2
     ORDER BY data_criacao DESC`,
    [ADMIN_ONLY_VISIBILITY, normalizeText(user.username)]
  );
  return rows.map(fromRow);
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
  const dataLimite = buildSlaLimitFromDate(now, settings.sla.hoursByPriority[prioridade], calendar);

  const [row] = await query(
    `INSERT INTO chamados
       (id, assunto, solicitante, local, categoria, prioridade, problema, user_id,
        status, resposta, data_criacao, data_atualizacao, data_limite)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '', $10, $10, $11)
     RETURNING *`,
    [
      crypto.randomUUID(),
      assunto,
      user.username,
      local,
      categoria,
      prioridade,
      problema,
      user.id,
      STATUS_ABERTO,
      now,
      dataLimite,
    ]
  );
  const chamado = fromRow(row);

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

  if (!UUID.test(String(id))) {
    throw notFound("Chamado não encontrado.");
  }

  const { previous, updated } = await transaction(async (tx) => {
    // FOR UPDATE trava o chamado até o fim da transação: duas pessoas
    // alterando ao mesmo tempo são atendidas uma depois da outra.
    const [row] = await tx("SELECT * FROM chamados WHERE id = $1 FOR UPDATE", [id]);
    const current = row ? fromRow(row) : null;

    if (!current || !canSeeChamado(current, user)) {
      throw notFound("Chamado não encontrado.");
    }

    const nextStatus = hasStatus ? data.status : current.status;
    const nextResposta = hasResposta ? data.resposta.trim() : (current.resposta ?? "");

    // Chamado fechado precisa sempre ter resposta (ao fechar e ao editar depois).
    if (nextStatus === STATUS_FECHADO && !nextResposta) {
      throw badRequest("Escreva a resposta da TI antes de fechar o chamado.");
    }

    const now = new Date();
    const closing = nextStatus === STATUS_FECHADO && current.status !== STATUS_FECHADO;
    const reopening = nextStatus !== STATUS_FECHADO && current.status === STATUS_FECHADO;

    let closeFields = [
      current.dataFechamento ?? null,
      current.closedByUsername ?? null,
      current.closedByName ?? null,
      current.closedByRole ?? null,
      current.slaViolado ?? null,
      current.autoClosed ?? null,
    ];

    if (closing) {
      const slaViolado = current.dataLimite ? new Date(current.dataLimite) < now : false;
      closeFields = [now.toISOString(), user.username, user.name, user.role, slaViolado, null];
    }

    if (reopening) {
      closeFields = [null, null, null, null, null, null];
    }

    const [saved] = await tx(
      `UPDATE chamados SET
         status = $2, resposta = $3, data_atualizacao = $4,
         data_fechamento = $5, closed_by_username = $6, closed_by_name = $7,
         closed_by_role = $8, sla_violado = $9, auto_closed = $10
       WHERE id = $1
       RETURNING *`,
      [id, nextStatus, nextResposta, now.toISOString(), ...closeFields]
    );

    return { previous: current, updated: fromRow(saved) };
  });

  const statusChanged = previous.status !== updated.status;

  if (
    statusChanged &&
    [STATUS_EM_ANDAMENTO, STATUS_FECHADO].includes(updated.status) &&
    updated.visibility !== ADMIN_ONLY_VISIBILITY
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
