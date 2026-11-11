// Remove, uma única vez por navegador, dados antigos de versões anteriores
// do ClickHELP (inclusive usuários com senha em texto puro). A sessão atual
// ("Manter conectado") não é apagada.
const CLEANUP_MARKER_KEY = "clickhelp.storage.cleanup.v2";
const LEGACY_LOCAL_KEYS = [
  "clickhelp.auth.users",
  "clickhelp.chamados",
  "clickhelp.chamados.meta",
  "clickhelp.notifications",
];
const LEGACY_LOCAL_PREFIXES = [
  "clickhelp.notifications.dismissed.",
  "clickhelp.notifications.history-seen.",
  "clickhelp.notifications.archive.",
];
const LEGACY_SESSION_KEYS = ["usuario-logado"];

export const clearLegacyBrowserStorageOnce = () => {
  try {
    const { localStorage, sessionStorage } = window;

    if (localStorage.getItem(CLEANUP_MARKER_KEY) === "done") {
      return;
    }

    LEGACY_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
    LEGACY_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));

    const prefixedKeys = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (key && LEGACY_LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        prefixedKeys.push(key);
      }
    }

    prefixedKeys.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(CLEANUP_MARKER_KEY, "done");
  } catch {
    // armazenamento indisponível (modo privado etc.): nada a limpar
  }
};
