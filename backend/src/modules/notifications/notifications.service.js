import crypto from "node:crypto";
import { createJsonStore } from "../../shared/storage/jsonStore.js";

const store = createJsonStore("notificationsStore.json");
const MAX_NOTIFICATIONS = 500;
const ACTIVE_LIMIT = 30;
const ARCHIVE_LIMIT = 30;

const normalizeUsername = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const matchesUser = (notification, user) => {
  const username = normalizeUsername(user.username);
  const usernames = (notification.recipients?.usernames ?? []).map(normalizeUsername);
  const roles = notification.recipients?.roles ?? [];
  const excluded = (notification.recipients?.excludeUsernames ?? []).map(normalizeUsername);

  if (excluded.includes(username)) {
    return false;
  }

  return usernames.includes(username) || roles.includes(user.role);
};

const toPublic = (notification, user) => {
  const username = normalizeUsername(user.username);

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    context: notification.context ?? {},
    createdAt: notification.createdAt,
    read: (notification.readBy ?? []).includes(username),
  };
};

export const createNotification = ({ type, title, message, recipients, context = {} }) =>
  store.update((items) => {
    const notification = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      recipients: {
        usernames: recipients?.usernames ?? [],
        roles: recipients?.roles ?? [],
        excludeUsernames: recipients?.excludeUsernames ?? [],
      },
      context,
      createdAt: new Date().toISOString(),
      readBy: [],
      archivedBy: [],
    };

    return {
      items: [notification, ...items].slice(0, MAX_NOTIFICATIONS),
      result: notification,
    };
  });

export const listNotificationsForUser = async (user) => {
  const username = normalizeUsername(user.username);
  const mine = (await store.read()).filter((item) => matchesUser(item, user));
  const active = mine.filter((item) => !(item.archivedBy ?? []).includes(username));
  const archived = mine.filter((item) => (item.archivedBy ?? []).includes(username));

  return {
    notifications: active.slice(0, ACTIVE_LIMIT).map((item) => toPublic(item, user)),
    archived: archived.slice(0, ARCHIVE_LIMIT).map((item) => toPublic(item, user)),
    unreadCount: active.filter((item) => !(item.readBy ?? []).includes(username)).length,
  };
};

/** Marca como lidas as notificações informadas, ou todas quando `all` for true. */
export const markNotificationsAsRead = (user, ids, { all = false } = {}) => {
  const username = normalizeUsername(user.username);
  const idSet = new Set(Array.isArray(ids) ? ids : []);

  return store.update((items) => {
    let changed = false;

    const nextItems = items.map((item) => {
      if (
        (!all && !idSet.has(item.id)) ||
        !matchesUser(item, user) ||
        (item.readBy ?? []).includes(username)
      ) {
        return item;
      }

      changed = true;
      return { ...item, readBy: [...(item.readBy ?? []), username] };
    });

    return { items: changed ? nextItems : null, result: null };
  });
};

/** Arquiva as notificações apenas para o usuário atual (não afeta os demais). */
export const archiveNotificationsForUser = (user) => {
  const username = normalizeUsername(user.username);

  return store.update((items) => {
    let changed = false;

    const nextItems = items.map((item) => {
      if (!matchesUser(item, user) || (item.archivedBy ?? []).includes(username)) {
        return item;
      }

      changed = true;
      return {
        ...item,
        archivedBy: [...(item.archivedBy ?? []), username],
        readBy: Array.from(new Set([...(item.readBy ?? []), username])),
      };
    });

    return { items: changed ? nextItems : null, result: null };
  });
};
