import { api } from "./api";

// As notificações ficam no backend; aqui só mantemos um cache em memória
// compartilhado entre os componentes e atualizado por polling.
const POLL_INTERVAL_MS = 20000;
const TOASTED_PREFIX = "clickhelp.notifications.toasted.";
const MAX_TOASTED_IDS = 300;

const EMPTY_STATE = { notifications: [], archived: [], unreadCount: 0 };

let state = EMPTY_STATE;
const listeners = new Set();
let pollTimer = null;

const emit = () => listeners.forEach((listener) => listener(state));

const applyResponse = (data) => {
  state = {
    notifications: data?.notifications ?? [],
    archived: data?.archived ?? [],
    unreadCount: data?.unreadCount ?? 0,
  };
  emit();
  return state;
};

export const refreshNotifications = async () => {
  try {
    const { data } = await api.get("/notifications");
    return applyResponse(data);
  } catch {
    return state;
  }
};

export const markNotificationsAsRead = async (ids) => {
  if (!ids?.length) {
    return state;
  }

  const { data } = await api.post("/notifications/read", { ids });
  return applyResponse(data);
};

/** Marca todas as notificações do usuário como lidas (inclusive as fora da lista exibida). */
export const markAllNotificationsAsRead = async () => {
  const { data } = await api.post("/notifications/read", { all: true });
  return applyResponse(data);
};

/** Move as notificações do usuário atual para o histórico. */
export const clearNotifications = async () => {
  const { data } = await api.post("/notifications/clear");
  return applyResponse(data);
};

export const getNotificationsState = () => state;

/** Assina as mudanças; o polling roda enquanto houver alguém assinando. */
export const subscribeNotifications = (listener) => {
  listeners.add(listener);

  if (!pollTimer) {
    refreshNotifications();
    pollTimer = window.setInterval(refreshNotifications, POLL_INTERVAL_MS);
  }

  return () => {
    listeners.delete(listener);

    if (!listeners.size && pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  };
};

export const resetNotificationsState = () => {
  state = EMPTY_STATE;
  emit();
};

// --- Controle local dos "toasts" já exibidos neste navegador ---

const toastedKey = (username) => `${TOASTED_PREFIX}${String(username ?? "").trim().toLowerCase()}`;

export const readToastedIds = (username) => {
  try {
    const rawValue = window.localStorage.getItem(toastedKey(username));
    return new Set(rawValue ? JSON.parse(rawValue) : []);
  } catch {
    return new Set();
  }
};

export const saveToastedIds = (username, ids) => {
  try {
    window.localStorage.setItem(
      toastedKey(username),
      JSON.stringify(Array.from(ids).slice(-MAX_TOASTED_IDS))
    );
  } catch {
    // armazenamento indisponível: apenas não lembra os toasts exibidos
  }
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
