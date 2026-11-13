import crypto from "node:crypto";
import { query, toIso, transaction } from "../../shared/db/database.js";

const MAX_NOTIFICATIONS = 500;
const ACTIVE_LIMIT = 30;
const ARCHIVE_LIMIT = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeUsername = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeList = (values) => (values ?? []).map(normalizeUsername).filter(Boolean);

// Notificações destinadas ao usuário ($1 = login, $2 = perfil): pelo nome ou
// pelo perfil, a menos que ele esteja na lista de excluídos.
const MATCHES_USER = `
  NOT ($1 = ANY (n.exclude_usernames))
  AND ($1 = ANY (n.recipient_usernames) OR $2 = ANY (n.recipient_roles))
`;

const toPublic = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  message: row.message,
  context: row.context ?? {},
  createdAt: toIso(row.created_at),
  read: Boolean(row.read_at),
});

export const createNotification = ({ type, title, message, recipients, context = {} }) =>
  transaction(async (tx) => {
    const [row] = await tx(
      `INSERT INTO notifications
         (id, type, title, message, recipient_usernames, recipient_roles, exclude_usernames, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING *`,
      [
        crypto.randomUUID(),
        type,
        title,
        message,
        normalizeList(recipients?.usernames),
        recipients?.roles ?? [],
        normalizeList(recipients?.excludeUsernames),
        JSON.stringify(context),
      ]
    );

    // Guarda só as mais recentes; as antigas saem junto com o status de leitura.
    await tx(
      `DELETE FROM notifications
       WHERE id IN (SELECT id FROM notifications ORDER BY created_at DESC OFFSET $1)`,
      [MAX_NOTIFICATIONS]
    );

    return row;
  });

export const listNotificationsForUser = async (user) => {
  const rows = await query(
    `SELECT n.*, s.read_at, s.archived_at
     FROM notifications n
     LEFT JOIN notification_status s ON s.notification_id = n.id AND s.username = $1
     WHERE ${MATCHES_USER}
     ORDER BY n.created_at DESC`,
    [normalizeUsername(user.username), user.role]
  );

  const active = rows.filter((row) => !row.archived_at);
  const archived = rows.filter((row) => row.archived_at);

  return {
    notifications: active.slice(0, ACTIVE_LIMIT).map(toPublic),
    archived: archived.slice(0, ARCHIVE_LIMIT).map(toPublic),
    unreadCount: active.filter((row) => !row.read_at).length,
  };
};

/** Marca como lidas as notificações informadas, ou todas quando `all` for true. */
export const markNotificationsAsRead = async (user, ids, { all = false } = {}) => {
  const validIds = (Array.isArray(ids) ? ids : []).filter((id) => UUID.test(String(id)));

  if (!all && !validIds.length) {
    return;
  }

  await query(
    `INSERT INTO notification_status (notification_id, username, read_at)
     SELECT n.id, $1, NOW()
     FROM notifications n
     WHERE ${MATCHES_USER} AND ($3 OR n.id = ANY ($4::uuid[]))
     ON CONFLICT (notification_id, username)
     DO UPDATE SET read_at = COALESCE(notification_status.read_at, EXCLUDED.read_at)`,
    [normalizeUsername(user.username), user.role, all, validIds]
  );
};

/** Arquiva as notificações apenas para o usuário atual (não afeta os demais). */
export const archiveNotificationsForUser = async (user) => {
  await query(
    `INSERT INTO notification_status (notification_id, username, read_at, archived_at)
     SELECT n.id, $1, NOW(), NOW()
     FROM notifications n
     WHERE ${MATCHES_USER}
     ON CONFLICT (notification_id, username)
     DO UPDATE SET
       read_at = COALESCE(notification_status.read_at, EXCLUDED.read_at),
       archived_at = COALESCE(notification_status.archived_at, EXCLUDED.archived_at)`,
    [normalizeUsername(user.username), user.role]
  );
};
