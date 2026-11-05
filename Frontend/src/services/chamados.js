import axios from "axios";

const CHAMADOS_ENDPOINT =
  import.meta.env.VITE_CHAMADOS_ENDPOINT ?? "http://localhost:3001/api/chamados";

const buildSessionParams = (session) => ({
  role: session?.user?.role ?? "",
  username: session?.user?.username ?? "",
});

export const getChamadosForSession = async (session) => {
  const response = await axios.get(CHAMADOS_ENDPOINT, {
    params: buildSessionParams(session),
  });

  return response.data?.chamados ?? [];
};

export const getChamadosByUser = async (username, session) => {
  const response = await axios.get(CHAMADOS_ENDPOINT, {
    params: {
      ...buildSessionParams(session),
      solicitante: username,
    },
  });

  return response.data?.chamados ?? [];
};

export const createChamado = async ({
  assunto,
  solicitante,
  local,
  prioridade,
  problema,
  userId,
}) => {
  const response = await axios.post(CHAMADOS_ENDPOINT, {
    assunto,
    solicitante,
    local,
    prioridade,
    problema,
    userId,
  });

  return response.data?.chamado ?? null;
};

export const updateChamado = async (id, updates) => {
  const response = await axios.patch(`${CHAMADOS_ENDPOINT}/${id}`, updates);
  return response.data?.chamado ?? null;
};
