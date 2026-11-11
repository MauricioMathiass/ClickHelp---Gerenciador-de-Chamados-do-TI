import { config } from "../../config/env.js";
import { badRequest, notFound } from "../../shared/http/httpError.js";
import { createJsonStore } from "../../shared/storage/jsonStore.js";
import { ROLE_ADMIN, ROLE_USUARIO, VALID_ROLES } from "../../shared/roles.js";
import { hashPassword, safeTextEqual, verifyPassword } from "../../shared/security.js";

const store = createJsonStore("usersStore.json");
const ENV_ADMIN_ID = 1;
const MIN_PASSWORD_LENGTH = 6;

const normalizeUsername = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

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

  if (!user || user.active === false || !(await verifyPassword(plainPassword, user.passwordHash))) {
    return null;
  }

  return user;
};

/** Usuário ativo pelo id (usado para validar o token a cada requisição). */
export const findActiveUserById = async (id) => {
  const envAdmin = getEnvAdmin();

  if (envAdmin && Number(id) === ENV_ADMIN_ID) {
    return envAdmin;
  }

  const user = (await store.read()).find((item) => Number(item.id) === Number(id));
  return user && user.active !== false ? user : null;
};

const toListItem = (user, fromEnv = false) => ({
  ...sanitizeUser(user),
  active: user.active !== false,
  fromEnv,
  createdAt: user.createdAt ?? null,
});

/** Lista de usuários para a tela de administração. */
export const listUsers = async () => {
  const envAdmin = getEnvAdmin();
  const users = (await store.read()).map((user) => toListItem(user));
  return envAdmin ? [toListItem(envAdmin, true), ...users] : users;
};

/**
 * Atualiza perfil, departamento, status (ativo/inativo) e/ou senha de um
 * usuário. O administrador do .env não pode ser alterado por aqui, e ninguém
 * pode desativar a si mesmo ou tirar o próprio perfil de administrador.
 */
export const updateUser = async (id, { role, active, password, department }, actor) => {
  const nextDepartment = department === undefined ? undefined : String(department).trim().slice(0, 60);

  const numericId = Number(id);

  if (numericId === ENV_ADMIN_ID) {
    throw badRequest("O administrador principal é definido no arquivo .env e não pode ser alterado aqui.");
  }

  if (role !== undefined && !VALID_ROLES.includes(role)) {
    throw badRequest("Perfil inválido.");
  }

  if (active !== undefined && typeof active !== "boolean") {
    throw badRequest("Status inválido.");
  }

  const isSelf = Number(actor?.id) === numericId;

  if (isSelf && (active === false || (role !== undefined && role !== ROLE_ADMIN))) {
    throw badRequest(
      "Você não pode desativar o seu próprio usuário nem remover o seu perfil de administrador."
    );
  }

  let passwordHash;

  if (password !== undefined) {
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      throw badRequest(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    passwordHash = await hashPassword(String(password));
  }

  return store.update((users) => {
    const index = users.findIndex((user) => Number(user.id) === numericId);

    if (index === -1) {
      throw notFound("Usuário não encontrado.");
    }

    const next = {
      ...users[index],
      ...(role !== undefined ? { role } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(nextDepartment !== undefined ? { department: nextDepartment } : {}),
      ...(passwordHash
        ? {
            passwordHash,
            passwordUpdatedAt: new Date().toISOString(),
            passwordVersion: Number(users[index].passwordVersion ?? 0) + 1,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    const nextUsers = [...users];
    nextUsers[index] = next;
    return { items: nextUsers, result: toListItem(next) };
  });
};

const buildUsername = (name, surname, takenUsernames) => {
  const baseUsername =
    `${normalizeNameToken(name)}.${normalizeNameToken(surname)}`
      .replace(/\.+/g, ".")
      .replace(/^\.+|\.+$/g, "") || `usuario.${Date.now()}`;
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
    throw badRequest("Preencha todos os campos obrigatórios.");
  }

  if (plainPassword.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  if (!VALID_ROLES.includes(nextRole)) {
    throw badRequest("Perfil inválido.");
  }

  if (trimmedName.length > 60 || trimmedSurname.length > 60) {
    throw badRequest("Nome e sobrenome aceitam no máximo 60 caracteres cada.");
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
      department: String(department ?? "")
        .trim()
        .slice(0, 60),
      createdAt: new Date().toISOString(),
    };

    return { items: [...users, newUser], result: newUser };
  });
};
