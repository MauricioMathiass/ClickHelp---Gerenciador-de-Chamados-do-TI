import { api, getApiErrorMessage } from "../../shared/services/api";

/** Lista de usuários (somente administradores). */
export const listUsers = async () => {
  const { data } = await api.get("/users");
  return data?.users ?? [];
};

/** Cadastra um usuário (somente administradores). */
export const createUser = async ({ name, surname, password, role, department }) => {
  try {
    const { data } = await api.post("/users", { name, surname, password, role, department });
    return data.user;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Não foi possível cadastrar o usuário."));
  }
};

/** Altera perfil, departamento, status (ativo) e/ou senha de um usuário. */
export const updateUser = async (id, changes) => {
  try {
    const { data } = await api.patch(`/users/${encodeURIComponent(id)}`, changes);
    return data?.user ?? null;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Não foi possível atualizar o usuário."));
  }
};

const normalizeNameToken = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

/**
 * Prévia do login que o backend vai gerar (nome.sobrenome). Segue a mesma
 * regra do servidor: se o login já existe, acrescenta .2, .3...
 */
export const buildUsernamePreview = (name, surname, existingUsernames = []) => {
  const base = `${normalizeNameToken(name)}.${normalizeNameToken(surname)}`
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  if (!base) {
    return "";
  }

  const taken = new Set(existingUsernames);
  let candidate = base;
  let counter = 1;

  while (taken.has(candidate)) {
    counter += 1;
    candidate = `${base}.${counter}`;
  }

  return candidate;
};
