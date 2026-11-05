import axios from "axios";

const PERSISTENT_STORAGE_KEY = "clickhelp.auth";
const SESSION_STORAGE_KEY = "clickhelp.auth.session";
const REMEMBERED_LOGIN_KEY = "clickhelp.rememberedLogin";
const CUSTOM_USERS_STORAGE_KEY = "clickhelp.auth.users";

const MOCK_USERS = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const safeStorage = (type) => {
  if (typeof window === "undefined") {
    return null;
  }

  return type === "local" ? window.localStorage : window.sessionStorage;
};

const normalizeUsername = (value) => value.trim().toLowerCase();
const normalizePassword = (value) => value.trim();

const readCustomUsers = () => {
  const storage = safeStorage("local");

  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(CUSTOM_USERS_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : [];
  } catch {
    return [];
  }
};

const writeCustomUsers = (users) => {
  const storage = safeStorage("local");

  if (!storage) {
    return;
  }

  storage.setItem(CUSTOM_USERS_STORAGE_KEY, JSON.stringify(users));
};

const getAllMockUsers = () => [...MOCK_USERS, ...readCustomUsers()];

const normalizeNameToken = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

const buildUsernameFromName = (name, surname, existingUsers) => {
  const baseUsername = `${normalizeNameToken(name)}.${normalizeNameToken(surname)}`.replace(/\.+/g, ".");
  let candidate = baseUsername || `usuario.${Date.now()}`;
  let counter = 1;

  while (existingUsers.some((user) => normalizeUsername(user.username) === candidate)) {
    counter += 1;
    candidate = `${baseUsername}.${counter}`;
  }

  return candidate;
};

export const buildDisplayUsernamePreview = (name, surname) => {
  const preview = `${normalizeNameToken(name)}.${normalizeNameToken(surname)}`.replace(/\.+/g, ".");
  return preview.replace(/^\.+|\.+$/g, "");
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

  storage.setItem(
    REMEMBERED_LOGIN_KEY,
    JSON.stringify({
      username,
      rememberMe: true,
    })
  );
};

const persistSession = (session, rememberMe) => {
  const storage = safeStorage(rememberMe ? "local" : "session");

  if (!storage) {
    return;
  }

  clearAuthSessionStorage();
  storage.setItem(
    rememberMe ? PERSISTENT_STORAGE_KEY : SESSION_STORAGE_KEY,
    JSON.stringify(session)
  );
};

const buildSession = (user, rememberMe, token = null) => ({
  token: token ?? `mock-token-${user.id}-${Date.now()}`,
  rememberMe,
  authenticatedAt: new Date().toISOString(),
  user: {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    department: user.department,
  },
});

const registerWithRemote = async ({ name, surname, password }) => {
  const endpoint =
    import.meta.env.VITE_AUTH_REGISTER_ENDPOINT ?? "http://localhost:3001/api/auth/register";

  const response = await axios.post(endpoint, {
    name,
    surname,
    password,
  });

  return response.data?.user ?? null;
};

const loginWithMock = async ({ username, password, rememberMe }) => {
  await sleep(700);

  const user = getAllMockUsers().find(
    (entry) =>
      normalizeUsername(entry.username) === normalizeUsername(username) &&
      entry.passwords.includes(normalizePassword(password))
  );

  if (!user) {
    throw new Error("Usuario ou senha invalidos.");
  }

  const session = buildSession(user, rememberMe);
  persistSession(session, rememberMe);
  persistRememberedLogin({
    username: user.username,
    rememberMe,
  });
  return session;
};

const loginWithRemote = async ({ username, password, rememberMe }) => {
  const endpoint =
    import.meta.env.VITE_AUTH_ENDPOINT ?? "http://localhost:3001/api/auth/login";

  const response = await axios.post(endpoint, { username, password });
  const responseUser = response.data?.user ?? {};

  const session = buildSession(
    {
      id: responseUser.id ?? Date.now(),
      username: responseUser.username ?? username,
      name: responseUser.name ?? responseUser.username ?? username,
      role: responseUser.role ?? "Usuario",
      department: responseUser.department ?? "Atendimento",
    },
    rememberMe,
    response.data?.token ?? null
  );

  persistSession(session, rememberMe);
  persistRememberedLogin({
    username: responseUser.username ?? username,
    rememberMe,
  });
  return session;
};

export const loginUser = async ({ username, password, rememberMe }) => {
  const authMode = import.meta.env.VITE_AUTH_MODE ?? "mock";

  if (authMode === "remote") {
    try {
      return await loginWithRemote({ username, password, rememberMe });
    } catch (error) {
      const message = error.response?.data?.message;
      throw new Error(message || "Nao foi possivel autenticar no servidor.");
    }
  }

  return loginWithMock({ username, password, rememberMe });
};

export const getStoredSession = () => {
  const storedValues = [
    safeStorage("local")?.getItem(PERSISTENT_STORAGE_KEY),
    safeStorage("session")?.getItem(SESSION_STORAGE_KEY),
  ].filter(Boolean);

  for (const value of storedValues) {
    try {
      return JSON.parse(value);
    } catch {
      continue;
    }
  }

  return null;
};

export const logoutUser = () => {
  clearAuthSessionStorage();
};

export const getRememberedLogin = () => {
  const storage = safeStorage("local");

  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(REMEMBERED_LOGIN_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

export const createMockUser = ({ name, surname, password }) => {
  const trimmedName = name.trim();
  const trimmedSurname = surname.trim();
  const trimmedPassword = password.trim();

  if (!trimmedName || !trimmedSurname || !trimmedPassword) {
    throw new Error("Preencha todos os campos obrigatorios.");
  }

  const customUsers = readCustomUsers();
  const allUsers = [...MOCK_USERS, ...customUsers];
  const username = buildUsernameFromName(trimmedName, trimmedSurname, allUsers);
  const nextId = allUsers.reduce((highestId, user) => Math.max(highestId, Number(user.id) || 0), 0) + 1;

  const newUser = {
    id: nextId,
    username,
    passwords: [trimmedPassword],
    name: `${trimmedName} ${trimmedSurname}`,
    role: "Usuario",
    department: "Atendimento",
  };

  writeCustomUsers([newUser, ...customUsers]);
  return newUser;
};

export const createUser = async ({ name, surname, password }) => {
  const authMode = import.meta.env.VITE_AUTH_MODE ?? "mock";

  if (authMode === "remote") {
    try {
      return await registerWithRemote({ name, surname, password });
    } catch (error) {
      const message = error.response?.data?.message;
      throw new Error(message || "Nao foi possivel cadastrar o usuario.");
    }
  }

  return createMockUser({ name, surname, password });
};
