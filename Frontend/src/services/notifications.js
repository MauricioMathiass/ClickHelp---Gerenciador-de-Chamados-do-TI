const STORAGE_KEY = "clickhelp.notifications";
const DISMISSED_PREFIX = "clickhelp.notifications.dismissed.";
const HISTORY_SEEN_PREFIX = "clickhelp.notifications.history-seen.";
const ARCHIVE_PREFIX = "clickhelp.notifications.archive.";
const LOCAL_EVENT_NAME = "clickhelp:notifications-updated";
const MAX_NOTIFICATIONS = 200;

export const TI_NOTIFICATION_ROLES = ["Administrador", "Analista de TI"];

const isBrowser = typeof window !== "undefined";

const readNotifications = () => {
  if (!isBrowser) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : [];
  } catch {
    return [];
  }
};

const writeNotifications = (notifications) => {
  if (!isBrowser) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
};

const buildDismissedKey = (username) => `${DISMISSED_PREFIX}${String(username ?? "").trim().toLowerCase()}`;
const buildHistorySeenKey = (username) =>
  `${HISTORY_SEEN_PREFIX}${String(username ?? "").trim().toLowerCase()}`;
const buildArchiveKey = (username) => `${ARCHIVE_PREFIX}${String(username ?? "").trim().toLowerCase()}`;

const readSeenIds = (username) => {
  if (!isBrowser || !username) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(buildDismissedKey(username));
    return rawValue ? JSON.parse(rawValue) : [];
  } catch {
    return [];
  }
};

const writeSeenIds = (username, ids) => {
  if (!isBrowser || !username) {
    return;
  }

  window.localStorage.setItem(buildDismissedKey(username), JSON.stringify(ids));
};

const readHistorySeenIds = (username) => {
  if (!isBrowser || !username) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(buildHistorySeenKey(username));
    return rawValue ? JSON.parse(rawValue) : [];
  } catch {
    return [];
  }
};

const writeHistorySeenIds = (username, ids) => {
  if (!isBrowser || !username) {
    return;
  }

  window.localStorage.setItem(buildHistorySeenKey(username), JSON.stringify(ids));
};

const readArchivedNotifications = (username) => {
  if (!isBrowser || !username) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(buildArchiveKey(username));
    return rawValue ? JSON.parse(rawValue) : [];
  } catch {
    return [];
  }
};

const writeArchivedNotifications = (username, notifications) => {
  if (!isBrowser || !username) {
    return;
  }

  window.localStorage.setItem(
    buildArchiveKey(username),
    JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS))
  );
};

const clearSeenIds = (username) => {
  if (!isBrowser || !username) {
    return;
  }

  window.localStorage.removeItem(buildDismissedKey(username));
};

const clearHistorySeenIds = (username) => {
  if (!isBrowser || !username) {
    return;
  }

  window.localStorage.removeItem(buildHistorySeenKey(username));
};

const emitNotificationsUpdated = () => {
  if (!isBrowser) {
    return;
  }

  window.dispatchEvent(new CustomEvent(LOCAL_EVENT_NAME));
};

export const createAppNotification = ({
  type,
  title,
  message,
  recipients,
  context = {},
}) => {
  const notification = {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    recipients,
    context,
    createdAt: new Date().toISOString(),
  };

  const notifications = readNotifications();
  notifications.unshift(notification);
  writeNotifications(notifications);
  emitNotificationsUpdated();
  return notification;
};

export const subscribeNotifications = (listener) => {
  if (!isBrowser) {
    return () => {};
  }

  const notify = () => listener(readNotifications());
  const handleStorage = (event) => {
    if (event.key === STORAGE_KEY) {
      notify();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(LOCAL_EVENT_NAME, notify);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LOCAL_EVENT_NAME, notify);
  };
};

export const requestBrowserNotificationPermission = async () => {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }

  if (Notification.permission !== "default") {
    return Notification.permission;
  }

  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
};

const notificationMatchesSession = (notification, session) => {
  if (!session?.user) {
    return false;
  }

  const usernames = notification.recipients?.usernames ?? [];
  const roles = notification.recipients?.roles ?? [];
  const currentUsername = String(session.user.username ?? "").trim().toLowerCase();
  const currentRole = session.user.role ?? "";

  return (
    usernames.some((username) => String(username).trim().toLowerCase() === currentUsername) ||
    roles.includes(currentRole)
  );
};

export const getPendingNotificationsForSession = (session) => {
  if (!session?.user?.username) {
    return [];
  }

  const seenIds = new Set(readSeenIds(session.user.username));

  return readNotifications().filter(
    (notification) => notificationMatchesSession(notification, session) && !seenIds.has(notification.id)
  );
};

export const getNotificationsForSession = (session, limit = 12) => {
  if (!session?.user?.username) {
    return [];
  }

  const notifications = readNotifications().filter((notification) =>
    notificationMatchesSession(notification, session)
  );

  if (!Number.isFinite(limit) || limit <= 0) {
    return notifications;
  }

  return notifications.slice(0, limit);
};

export const getUnreadNotificationCountForSession = (session) => {
  if (!session?.user?.username) {
    return 0;
  }

  const seenIds = new Set(readHistorySeenIds(session.user.username));

  return readNotifications().filter(
    (notification) => notificationMatchesSession(notification, session) && !seenIds.has(notification.id)
  ).length;
};

export const getArchivedNotificationsForSession = (session, limit = 20) => {
  if (!session?.user?.username) {
    return [];
  }

  const notifications = readArchivedNotifications(session.user.username);

  if (!Number.isFinite(limit) || limit <= 0) {
    return notifications;
  }

  return notifications.slice(0, limit);
};

export const markNotificationHistoryAsSeen = (session, notificationIds) => {
  if (!session?.user?.username || !notificationIds.length) {
    return;
  }

  const currentIds = new Set(readHistorySeenIds(session.user.username));
  notificationIds.forEach((id) => currentIds.add(id));
  writeHistorySeenIds(session.user.username, Array.from(currentIds));
  emitNotificationsUpdated();
};

export const clearNotificationsForSession = (session) => {
  if (!session?.user?.username) {
    return;
  }

  const matchingNotifications = readNotifications().filter((notification) =>
    notificationMatchesSession(notification, session)
  );
  const nextNotifications = readNotifications().filter(
    (notification) => !notificationMatchesSession(notification, session)
  );

  writeNotifications(nextNotifications);
  if (matchingNotifications.length) {
    const currentArchive = readArchivedNotifications(session.user.username);
    writeArchivedNotifications(session.user.username, [...matchingNotifications, ...currentArchive]);
  }
  clearSeenIds(session.user.username);
  clearHistorySeenIds(session.user.username);
  emitNotificationsUpdated();
};

export const markNotificationsAsSeen = (session, notificationIds) => {
  if (!session?.user?.username || !notificationIds.length) {
    return;
  }

  const currentIds = new Set(readSeenIds(session.user.username));
  notificationIds.forEach((id) => currentIds.add(id));
  writeSeenIds(session.user.username, Array.from(currentIds));
};
