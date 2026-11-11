import { api } from "./api";

/** Chamados que o usuário logado pode ver (o backend filtra pelo token). */
export const getChamados = async () => {
  const { data } = await api.get("/chamados");
  return data?.chamados ?? [];
};

export const createChamado = async ({ assunto, local, prioridade, problema }) => {
  const { data } = await api.post("/chamados", { assunto, local, prioridade, problema });
  return data?.chamado ?? null;
};

/** Atualiza apenas status e/ou resposta; o restante é calculado no backend. */
export const updateChamado = async (id, { status, resposta }) => {
  const { data } = await api.patch(`/chamados/${encodeURIComponent(id)}`, { status, resposta });
  return data?.chamado ?? null;
};
