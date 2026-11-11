import { api, getApiErrorMessage } from "./api";

/** Lista de usuários (somente administradores). */
export const listUsers = async () => {
  const { data } = await api.get("/auth/users");
  return data?.users ?? [];
};

/** Altera perfil, status (ativo) e/ou senha de um usuário. */
export const updateUser = async (id, changes) => {
  try {
    const { data } = await api.patch(`/auth/users/${encodeURIComponent(id)}`, changes);
    return data?.user ?? null;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Não foi possível atualizar o usuário."));
  }
};
