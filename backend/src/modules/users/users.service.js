import { config } from "../../config/env.js";
import { badRequest, notFound } from "../../shared/http/httpError.js";
import { query, toIso } from "../../shared/db/database.js";
import { ROLE_ADMIN, ROLE_USUARIO, VALID_ROLES } from "../../shared/roles.js";
import { hashPassword, safeTextEqual, verifyPassword } from "../../shared/security.js";

const ENV_ADMIN_ID = 1;
const MIN_PASSWORD_LENGTH = 6;
const UNIQUE_VIOLATION = "23505";

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

const fromRow = (row) => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  name: row.name,
  role: row.role,
  department: row.department,
  active: row.active,
  passwordVersion: row.password_version,
  passwordUpdatedAt: toIso(row.password_updated_at),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

/** Administrador inicial, definido no .env (não fica gravado no banco). */
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

  const [row] = await query("SELECT * FROM users WHERE username = $1", [normalizedUsername]);
  const user = row ? fromRow(row) : null;

  if (!user || !user.active || !(await verifyPassword(plainPassword, user.passwordHash))) {
    return null;
  }

  return user;
};

/** Usuário ativo pelo id (usado para validar o token a cada requisição). */
export const findActiveUserById = async (id) => {
  const envAdmin = getEnvAdmin();
  const numericId = Number(id);

  if (envAdmin && numericId === ENV_ADMIN_ID) {
    return envAdmin;
  }

  if (!Number.isInteger(numericId)) {
    return null;
  }

  const [row] = await query("SELECT * FROM users WHERE id = $1 AND active", [numericId]);
  return row ? fromRow(row) : null;
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
  const rows = await query("SELECT * FROM users ORDER BY id");
  const users = rows.map((row) => toListItem(fromRow(row)));
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

  if (!Number.isInteger(numericId)) {
    throw notFound("Usuário não encontrado.");
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

  let passwordHash = null;

  if (password !== undefined) {
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      throw badRequest(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    passwordHash = await hashPassword(String(password));
  }

  // Campos não enviados (null) mantêm o valor atual. Trocar a senha muda a
  // versão dela, o que encerra as sessões abertas do usuário.
  const [row] = await query(
    `UPDATE users SET
       role = COALESCE($2, role),
       active = COALESCE($3, active),
       department = COALESCE($4, department),
       password_hash = COALESCE($5, password_hash),
       password_updated_at = CASE WHEN $5::text IS NULL THEN password_updated_at ELSE NOW() END,
       password_version = CASE WHEN $5::text IS NULL THEN password_version ELSE password_version + 1 END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [numericId, role ?? null, active ?? null, nextDepartment ?? null, passwordHash]
  );

  if (!row) {
    throw notFound("Usuário não encontrado.");
  }

  return toListItem(fromRow(row));
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
  const userDepartment = String(department ?? "")
    .trim()
    .slice(0, 60);

  // Dois cadastros iguais ao mesmo tempo podem escolher o mesmo login: o
  // índice único do banco barra o segundo, que tenta de novo com outro número.
  for (let attempt = 1; ; attempt += 1) {
    try {
      const rows = await query("SELECT username FROM users");
      const taken = new Set(rows.map((item) => item.username));
      const envAdmin = getEnvAdmin();

      if (envAdmin) {
        taken.add(envAdmin.username);
      }

      const [row] = await query(
        `INSERT INTO users (username, password_hash, name, role, department)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          buildUsername(trimmedName, trimmedSurname, taken),
          passwordHash,
          `${trimmedName} ${trimmedSurname}`,
          nextRole,
          userDepartment,
        ]
      );

      return fromRow(row);
    } catch (error) {
      if (error.code !== UNIQUE_VIOLATION || attempt >= 5) {
        throw error;
      }
    }
  }
};
