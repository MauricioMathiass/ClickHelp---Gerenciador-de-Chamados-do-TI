import { config } from "../config.js";
import { badRequest } from "../lib/httpError.js";
import { createJsonStore } from "../lib/jsonStore.js";
import { ROLE_ADMIN, ROLE_USUARIO, VALID_ROLES } from "../lib/roles.js";
import { hashPassword, safeTextEqual, verifyPassword } from "../lib/security.js";

const store = createJsonStore("usersStore.json");
const ENV_ADMIN_ID = 1;
const MIN_PASSWORD_LENGTH = 6;

const normalizeUsername = (value) => String(value ?? "").trim().toLowerCase();

const normalizeNameToken = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

/** Administrador inicial, definido no .env (não fica gravado em arquivo). */
const getEnvAdmin = () => {
  if (!config.admin.username || !config.admin.password) {
    return null;
  }

  return {
    id: ENV_ADMIN_ID,
    username: normalizeUsername(config.admin.username),
    name: config.admin.name,
    role: ROLE_ADMIN,
    department: config.admin.department,
  };
};

export const sanitizeUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  role: user.role,
  department: user.department,
});

export const findUserByCredentials = async ({ username, password }) => {
  const normalizedUsername = normalizeUsername(username);
  const plainPassword = String(password ?? "");
  const envAdmin = getEnvAdmin();

  if (envAdmin && envAdmin.username === normalizedUsername) {
    return safeTextEqual(plainPassword.trim(), config.admin.password) ? envAdmin : null;
  }

  const user = (await store.read()).find((item) => item.username === normalizedUsername);

  if (!user || !(await verifyPassword(plainPassword, user.passwordHash))) {
    return null;
  }

  return user;
};

const buildUsername = (name, surname, takenUsernames) => {
  const baseUsername =
    `${normalizeNameToken(name)}.${normalizeNameToken(surname)}`.replace(/\.+/g, ".").replace(/^\.+|\.+$/g, "") ||
    `usuario.${Date.now()}`;
  let candidate = baseUsername;
  let counter = 1;

  while (takenUsernames.has(candidate)) {
    counter += 1;
    candidate = `${baseUsername}.${counter}`;
  }

  return candidate;
};

export const createUser = async ({ name, surname, password, role, department }) => {
  const trimmedName = String(name ?? "").trim();
  const trimmedSurname = String(surname ?? "").trim();
  const plainPassword = String(password ?? "");
  const nextRole = role ? String(role) : ROLE_USUARIO;

  if (!trimmedName || !trimmedSurname || !plainPassword.trim()) {
    throw badRequest("Preencha todos os campos obrigatorios.");
  }

  if (plainPassword.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  if (!VALID_ROLES.includes(nextRole)) {
    throw badRequest("Perfil invalido.");
  }

  if (trimmedName.length > 60 || trimmedSurname.length > 60) {
    throw badRequest("Nome e sobrenome aceitam no maximo 60 caracteres cada.");
  }

  const passwordHash = await hashPassword(plainPassword);

  return store.update((users) => {
    const envAdmin = getEnvAdmin();
    const taken = new Set(users.map((user) => user.username));

    if (envAdmin) {
      taken.add(envAdmin.username);
    }

    const highestId = users.reduce((highest, user) => Math.max(highest, Number(user.id) || 0), ENV_ADMIN_ID);
    const newUser = {
      id: highestId + 1,
      username: buildUsername(trimmedName, trimmedSurname, taken),
      passwordHash,
      name: `${trimmedName} ${trimmedSurname}`,
      role: nextRole,
      department: String(department ?? "").trim() || "Atendimento",
      createdAt: new Date().toISOString(),
    };

    return { items: [...users, newUser], result: newUser };
  });
};
