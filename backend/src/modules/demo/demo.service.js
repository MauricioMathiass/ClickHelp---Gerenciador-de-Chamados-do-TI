// Dados de exemplo do modo demonstração (DEMO_MODE=true).
// Quem entra pelos botões da tela de login usa contas fixas (demo.*), sem
// senha. Os chamados dessas contas voltam ao original quando a última
// restauração tiver mais de RESET_INTERVAL_HOURS: assim o que um visitante
// fez não fica para o próximo. Chamados de contas reais nunca são apagados.
import crypto from "node:crypto";
import { transaction } from "../../shared/db/database.js";
import { DEMO_ACCOUNTS, DEMO_REQUESTERS, DEMO_USERNAMES } from "../../shared/demo.js";
import { badRequest } from "../../shared/http/httpError.js";
import { TI_ROLES } from "../../shared/roles.js";
import { getSettings, getWorkCalendar, updateSettings } from "../settings/settings.service.js";
import { buildSlaLimitFromDate } from "../tickets/sla.js";
import { STATUS_ABERTO, STATUS_EM_ANDAMENTO, STATUS_FECHADO } from "../tickets/tickets.constants.js";
import { findActiveUserById } from "../users/users.service.js";

export const RESET_INTERVAL_HOURS = 6;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Hash que nunca confere com nenhuma senha: as contas de demonstração só
// entram pelos botões da tela de login.
const NO_PASSWORD_HASH = "demo$sem-senha";

const ANALISTA = DEMO_ACCOUNTS.analista;
const MINUTE_MS = 60 * 1000;

/**
 * Empresa e locais fictícios: aplicados só quando a instalação ainda está com
 * os valores de fábrica (sem nome de empresa e só com o local "Matriz"), para
 * a demonstração mostrar o white-label sem sobrescrever uma configuração real.
 */
const DEMO_COMPANY_NAME = "Horizonte Distribuidora";
const DEMO_LOCATIONS = ["Matriz", "Filial Campinas", "Centro de Distribuição"];

/**
 * Chamados de exemplo, cada um com categoria e local próprios. `abertoHa` é
 * há quanto tempo foi aberto (com minutos quebrados, como na vida real);
 * `fechar` diz como terminou: "no-prazo" ou "atrasado". A mistura dá cerca
 * de 75% no prazo (6 fechados no prazo, 1 fechado e 1 aberto com atraso),
 * com um chamado atrasado e um quase vencendo para a fila ter o que mostrar.
 */
const SAMPLE_TICKETS = [
  {
    requester: DEMO_ACCOUNTS.usuario,
    assunto: "Impressora do financeiro não imprime",
    problema:
      "A impressora do 2º andar mostra 'papel atolado', mas não tem papel preso. Já desliguei e liguei.",
    categoria: "Impressoras",
    local: "Matriz",
    prioridade: "alta",
    abertoHa: 1 * HOUR_MS + 12 * MINUTE_MS,
    status: STATUS_ABERTO,
  },
  {
    requester: DEMO_ACCOUNTS.usuario,
    assunto: "Acesso à pasta de notas fiscais",
    problema:
      "Preciso de acesso de leitura à pasta compartilhada \\\\arquivos\\notas-fiscais para o fechamento do mês.",
    categoria: "Acesso e senhas",
    local: "Matriz",
    prioridade: "media",
    abertoHa: 4 * HOUR_MS + 35 * MINUTE_MS,
    status: STATUS_EM_ANDAMENTO,
    resposta: "Pedido aprovado pelo gestor. Estou liberando a permissão no servidor de arquivos.",
  },
  {
    requester: DEMO_ACCOUNTS.usuario,
    assunto: "Outlook pedindo senha toda hora",
    problema: "Desde ontem o Outlook pede a senha a cada poucos minutos e não sincroniza os e-mails.",
    categoria: "Software",
    local: "Matriz",
    prioridade: "alta",
    abertoHa: 12 * DAY_MS + 3 * HOUR_MS + 41 * MINUTE_MS,
    status: STATUS_FECHADO,
    fechar: "no-prazo",
    resposta: "O perfil do Outlook estava corrompido. Recriei o perfil e a sincronização voltou ao normal.",
  },
  {
    requester: DEMO_ACCOUNTS.usuario,
    assunto: "Planilha de fechamento não abre",
    problema: "A planilha de fechamento de outubro dá erro de arquivo corrompido ao abrir no Excel.",
    categoria: "Software",
    local: "Matriz",
    prioridade: "media",
    abertoHa: 6 * DAY_MS + 2 * HOUR_MS + 8 * MINUTE_MS,
    status: STATUS_FECHADO,
    fechar: "no-prazo",
    resposta: "Recuperei a versão de ontem pelo histórico do servidor. Nada foi perdido.",
  },
  {
    requester: DEMO_REQUESTERS.carlos,
    assunto: "Computador do atendimento muito lento",
    problema: "O computador do balcão 3 leva mais de 5 minutos para ligar e trava ao abrir o sistema.",
    categoria: "Hardware",
    local: "Filial Campinas",
    prioridade: "media",
    abertoHa: 5 * DAY_MS + 2 * HOUR_MS + 17 * MINUTE_MS,
    status: STATUS_ABERTO,
  },
  {
    requester: DEMO_REQUESTERS.carlos,
    assunto: "Wi-Fi caindo na sala de reunião",
    problema: "A internet sem fio cai várias vezes durante as reuniões com clientes.",
    categoria: "Rede e internet",
    local: "Filial Campinas",
    prioridade: "alta",
    abertoHa: 5 * HOUR_MS + 40 * MINUTE_MS,
    status: STATUS_EM_ANDAMENTO,
    resposta: "Vou trocar o access point da sala ainda hoje.",
  },
  {
    requester: DEMO_REQUESTERS.carlos,
    assunto: "Instalar leitor de PDF",
    problema: "Preciso de um leitor de PDF para assinar documentos no computador novo.",
    categoria: "Software",
    local: "Filial Campinas",
    prioridade: "baixa",
    abertoHa: 25 * DAY_MS + 4 * HOUR_MS + 26 * MINUTE_MS,
    status: STATUS_FECHADO,
    fechar: "no-prazo",
    resposta: "Leitor instalado e assinatura digital configurada.",
  },
  {
    requester: DEMO_REQUESTERS.carlos,
    assunto: "Leitor de código de barras sem resposta",
    problema: "O leitor do caixa 2 acende, mas não lê nenhum código desde a manhã.",
    categoria: "Hardware",
    local: "Filial Campinas",
    prioridade: "media",
    abertoHa: 9 * DAY_MS + 1 * HOUR_MS + 53 * MINUTE_MS,
    status: STATUS_FECHADO,
    fechar: "no-prazo",
    resposta: "O cabo USB estava com mau contato. Troquei o cabo e reconfigurei o leitor.",
  },
  {
    requester: DEMO_REQUESTERS.juliana,
    assunto: "Monitor piscando na recepção",
    problema: "O monitor da recepção fica piscando e às vezes apaga sozinho.",
    categoria: "Hardware",
    local: "Matriz",
    prioridade: "baixa",
    abertoHa: 2 * HOUR_MS + 20 * MINUTE_MS,
    status: STATUS_ABERTO,
  },
  {
    requester: DEMO_REQUESTERS.juliana,
    assunto: "Criar e-mail para novo funcionário",
    problema:
      "O João Pereira começa segunda-feira no administrativo e precisa de e-mail e acesso ao sistema.",
    categoria: "Acesso e senhas",
    local: "Matriz",
    prioridade: "media",
    abertoHa: 8 * DAY_MS + 5 * HOUR_MS + 4 * MINUTE_MS,
    status: STATUS_FECHADO,
    fechar: "no-prazo",
    resposta: "E-mail joao.pereira criado e acesso ao sistema liberado. Senha provisória entregue ao gestor.",
  },
  {
    requester: DEMO_REQUESTERS.juliana,
    assunto: "Telefone IP sem linha",
    problema: "O ramal 214 está sem linha desde a mudança de mesa.",
    categoria: "Rede e internet",
    local: "Centro de Distribuição",
    prioridade: "alta",
    abertoHa: 20 * DAY_MS + 3 * HOUR_MS + 32 * MINUTE_MS,
    status: STATUS_FECHADO,
    fechar: "atrasado",
    resposta: "O cabo de rede da nova mesa estava sem conexão no rack. Ramal funcionando.",
  },
  {
    requester: DEMO_REQUESTERS.juliana,
    assunto: "VPN não conecta em home office",
    problema: "Em casa, a VPN fica em 'conectando' e não abre o sistema interno.",
    categoria: "Rede e internet",
    local: "Matriz",
    prioridade: "alta",
    abertoHa: 15 * DAY_MS + 6 * HOUR_MS + 11 * MINUTE_MS,
    status: STATUS_FECHADO,
    fechar: "no-prazo",
    resposta: "O certificado da VPN no notebook tinha expirado. Instalei o novo e a conexão voltou.",
  },
];

/** 42 -> "#0042" (o mesmo formato da tela). */
const formatProtocolo = (numero) => (Number.isInteger(numero) ? `#${String(numero).padStart(4, "0")}` : "");

/** Usa o valor de exemplo só se ele existir no cadastro atual da empresa. */
const fromCatalog = (list, value, fallback) => (list.includes(value) ? value : (list[0] ?? fallback));

const upsertDemoUsers = async (tx) => {
  const users = new Map();

  for (const account of [...Object.values(DEMO_ACCOUNTS), ...Object.values(DEMO_REQUESTERS)]) {
    const [row] = await tx(
      `INSERT INTO users (username, password_hash, name, role, department)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE SET
         name = EXCLUDED.name, role = EXCLUDED.role, department = EXCLUDED.department, active = TRUE
       RETURNING *`,
      [account.username, NO_PASSWORD_HASH, account.name, account.role, account.department]
    );
    users.set(account.username, row);
  }

  return users;
};

const insertSampleTickets = async (tx, { users, settings, calendar, now }) => {
  const { locations, categories } = settings.catalog;
  const notifications = [];

  for (const sample of SAMPLE_TICKETS) {
    const requester = users.get(sample.requester.username);
    const createdAt = new Date(now - sample.abertoHa);
    const limit = new Date(
      buildSlaLimitFromDate(createdAt, settings.sla.hoursByPriority[sample.prioridade], calendar)
    );
    let closedAt = null;

    if (sample.status === STATUS_FECHADO) {
      // No prazo: perto da metade do tempo que havia até o limite.
      // Atrasado: meio dia depois do limite. Nunca depois do momento atual.
      const target =
        sample.fechar === "atrasado"
          ? limit.getTime() + 13 * HOUR_MS
          : createdAt.getTime() + (limit.getTime() - createdAt.getTime()) * 0.45;
      closedAt = new Date(Math.min(target, now - HOUR_MS));
    }

    const updatedAt =
      closedAt ?? (sample.status === STATUS_EM_ANDAMENTO ? new Date(now - 30 * 60 * 1000) : createdAt);
    const id = crypto.randomUUID();

    const [inserted] = await tx(
      `INSERT INTO chamados
         (id, assunto, solicitante, local, categoria, prioridade, problema, user_id, status, resposta,
          data_criacao, data_atualizacao, data_limite, data_fechamento,
          closed_by_username, closed_by_name, closed_by_role, sla_violado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING numero`,
      [
        id,
        sample.assunto,
        requester.username,
        fromCatalog(locations, sample.local, "Matriz"),
        fromCatalog(categories, sample.categoria, ""),
        sample.prioridade,
        sample.problema,
        requester.id,
        sample.status,
        sample.resposta ?? "",
        createdAt.toISOString(),
        updatedAt.toISOString(),
        limit.toISOString(),
        closedAt?.toISOString() ?? null,
        closedAt ? ANALISTA.username : null,
        closedAt ? ANALISTA.name : null,
        closedAt ? ANALISTA.role : null,
        closedAt ? limit < closedAt : null,
      ]
    );

    const protocolo = formatProtocolo(inserted?.numero);

    if (sample.status === STATUS_ABERTO) {
      notifications.push({
        type: "novo-chamado-ti",
        title: "Nova solicitação recebida",
        message: `${requester.name} abriu o chamado ${protocolo} "${sample.assunto}" e aguarda atendimento.`,
        roles: TI_ROLES,
        usernames: [],
        createdAt,
        chamadoId: id,
      });
    } else {
      notifications.push({
        type: "status-chamado-atualizado",
        title: `Chamado ${sample.status === STATUS_FECHADO ? "fechado" : "em andamento"}`,
        message:
          sample.status === STATUS_FECHADO
            ? `Sua solicitação ${protocolo} "${sample.assunto}" foi fechada. Veja a resposta da TI em Minhas solicitações.`
            : `A equipe de TI começou a atender sua solicitação ${protocolo} "${sample.assunto}".`,
        roles: [],
        usernames: [requester.username],
        createdAt: updatedAt,
        chamadoId: id,
      });
    }
  }

  for (const item of notifications) {
    await tx(
      `INSERT INTO notifications
         (id, type, title, message, recipient_usernames, recipient_roles, context, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        crypto.randomUUID(),
        item.type,
        item.title,
        item.message,
        item.usernames,
        item.roles,
        JSON.stringify({ chamadoId: item.chamadoId }),
        item.createdAt.toISOString(),
      ]
    );
  }
};

/** Dá nome de empresa e locais à demonstração, se a instalação ainda estiver de fábrica. */
const ensureDemoCompany = async (settings) => {
  const isFactory =
    !settings.branding.companyName &&
    settings.catalog.locations.length === 1 &&
    settings.catalog.locations[0] === "Matriz";

  if (!isFactory) {
    return settings;
  }

  return updateSettings({
    ...settings,
    branding: { ...settings.branding, companyName: DEMO_COMPANY_NAME },
    catalog: { ...settings.catalog, locations: DEMO_LOCATIONS },
  });
};

/**
 * Garante as contas de demonstração e, se a última restauração for antiga,
 * apaga os chamados delas e recria os de exemplo. Roda numa transação com a
 * linha de controle travada: dois visitantes ao mesmo tempo não restauram em dobro.
 */
export const prepareDemo = async ({ now = Date.now(), force = false } = {}) => {
  // Lidos antes da transação: no banco embutido, uma consulta fora dela
  // esperaria a transação terminar, e a transação esperaria a consulta.
  const settings = await ensureDemoCompany(await getSettings());
  const calendar = await getWorkCalendar();

  return transaction(async (tx) => {
    await tx("INSERT INTO demo_state (id, reset_at) VALUES (1, NULL) ON CONFLICT (id) DO NOTHING");
    const [state] = await tx("SELECT reset_at FROM demo_state WHERE id = 1 FOR UPDATE");
    const users = await upsertDemoUsers(tx);
    const lastReset = state.reset_at ? new Date(state.reset_at).getTime() : 0;

    if (!force && now - lastReset < RESET_INTERVAL_HOURS * HOUR_MS) {
      return users;
    }

    const removed = await tx(
      "DELETE FROM chamados WHERE LOWER(solicitante) = ANY ($1::text[]) RETURNING id::text AS id",
      [DEMO_USERNAMES]
    );
    await tx("DELETE FROM notifications WHERE context->>'chamadoId' = ANY ($1::text[])", [
      removed.map((row) => row.id),
    ]);
    await tx("DELETE FROM notification_status WHERE username = ANY ($1::text[])", [DEMO_USERNAMES]);
    await insertSampleTickets(tx, { users, settings, calendar, now });
    await tx("UPDATE demo_state SET reset_at = $1 WHERE id = 1", [new Date(now).toISOString()]);

    return users;
  });
};

/** Conta de demonstração do perfil escolhido na tela de login (restaurando os dados, se preciso). */
export const getDemoAccount = async (profile) => {
  const account = Object.hasOwn(DEMO_ACCOUNTS, String(profile)) ? DEMO_ACCOUNTS[profile] : null;

  if (!account) {
    throw badRequest("Perfil de demonstração inválido.");
  }

  const users = await prepareDemo();
  return findActiveUserById(users.get(account.username).id);
};
