const CLEANUP_MARKER_KEY = "clickhelp.storage.cleanup.v1";
const LOCAL_STORAGE_KEYS = [
  "clickhelp.auth",
  "clickhelp.rememberedLogin",
  "clickhelp.auth.users",
  "clickhelp.chamados",
  "clickhelp.chamados.meta",
  "clickhelp.notifications",
];
const SESSION_STORAGE_KEYS = ["clickhelp.auth.session", "usuario-logado"];
const LOCAL_STORAGE_PREFIXES = [
  "clickhelp.notifications.dismissed.",
  "clickhelp.notifications.history-seen.",
  "clickhelp.notifications.archive.",
];

const clearMatchingKeys = (storage, exactKeys, prefixes) => {
  if (!storage) {
    return;
  }

  exactKeys.forEach((key) => storage.removeItem(key));

  const keysToRemove = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
};

export const clearClickHelpBrowserStorageOnce = () => {
  if (typeof window === "undefined") {
    return;
  }

  const { localStorage, sessionStorage } = window;

  if (sessionStorage.getItem(CLEANUP_MARKER_KEY) === "done") {
    return;
  }

  clearMatchingKeys(localStorage, LOCAL_STORAGE_KEYS, LOCAL_STORAGE_PREFIXES);
  clearMatchingKeys(sessionStorage, SESSION_STORAGE_KEYS, []);
  sessionStorage.setItem(CLEANUP_MARKER_KEY, "done");
};
