import { api, getApiErrorMessage, getApiToken, setApiToken } from "../../shared/services/api";

const PERSISTENT_STORAGE_KEY = "clickhelp.auth";
const SESSION_STORAGE_KEY = "clickhelp.auth.session";
const REMEMBERED_LOGIN_KEY = "clickhelp.rememberedLogin";

const safeStorage = (type) => {
  if (typeof window === "undefined") {
    return null;
  }

  return type === "local" ? window.localStorage : window.sessionStorage;
};

/** Lê a validade do JWT (sem validar a assinatura — isso é papel do backend). */
const getTokenExpiration = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

const isSessionValid = (session) => {
  const expiresAt = session?.token ? getTokenExpiration(session.token) : null;
  return Boolean(session?.user && expiresAt && expiresAt > Date.now());
};

const clearAuthSessionStorage = () => {
  safeStorage("local")?.removeItem(PERSISTENT_STORAGE_KEY);
  safeStorage("session")?.removeItem(SESSION_STORAGE_KEY);
};

const persistRememberedLogin = ({ username, rememberMe }) => {
  const storage = safeStorage("local");

  if (!storage) {
    return;
  }

  if (!rememberMe) {
    storage.removeItem(REMEMBERED_LOGIN_KEY);
    return;
  }

  storage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify({ username, rememberMe: true }));
};

const persistSession = (session, rememberMe) => {
  clearAuthSessionStorage();
  safeStorage(rememberMe ? "local" : "session")?.setItem(
    rememberMe ? PERSISTENT_STORAGE_KEY : SESSION_STORAGE_KEY,
    JSON.stringify(session)
  );
};

export const loginUser = async ({ username, password, rememberMe }) => {
  try {
    const { data } = await api.post("/auth/login", { username, password, rememberMe });
    const session = {
      token: data.token,
      rememberMe,
      authenticatedAt: new Date().toISOString(),
      user: data.user,
    };

    setApiToken(session.token);
    persistSession(session, rememberMe);
    persistRememberedLogin({ username: data.user.username, rememberMe });
    return session;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Não foi possível autenticar no servidor."));
  }
};

/** Sessão salva no navegador, se ainda estiver válida. */
export const getStoredSession = () => {
  const storedValues = [
    safeStorage("local")?.getItem(PERSISTENT_STORAGE_KEY),
    safeStorage("session")?.getItem(SESSION_STORAGE_KEY),
  ].filter(Boolean);

  for (const value of storedValues) {
    try {
      const session = JSON.parse(value);

      if (isSessionValid(session)) {
        setApiToken(session.token);
        return session;
      }
    } catch {
      // ignora valor corrompido
    }
  }

  clearAuthSessionStorage();
  return null;
};

export const logoutUser = () => {
  setApiToken(null);
  clearAuthSessionStorage();
};

export const getRememberedLogin = () => {
  try {
    const rawValue = safeStorage("local")?.getItem(REMEMBERED_LOGIN_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

/**
 * Atualiza os dados do usuário da sessão salva (nome, perfil) com o que está
 * no backend agora. Devolve a sessão atualizada, ou null se falhar.
 */
export const refreshSessionUser = async (session) => {
  try {
    const { data } = await api.get("/auth/me");

    // Se a pessoa saiu (ou trocou de conta) enquanto a resposta vinha, ignora.
    if (!data?.user || getApiToken() !== session.token) {
      return null;
    }

    const nextSession = { ...session, user: data.user };
    persistSession(nextSession, Boolean(session.rememberMe));
    return nextSession;
  } catch {
    return null;
  }
};
