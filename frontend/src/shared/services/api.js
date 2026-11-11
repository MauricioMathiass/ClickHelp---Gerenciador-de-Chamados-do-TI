import axios from "axios";

export const SESSION_EXPIRED_EVENT = "clickhelp:session-expired";

let currentToken = null;

export const getApiToken = () => currentToken;

export const setApiToken = (token) => {
  currentToken = token || null;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3001/api",
  timeout: 15000,
});

api.interceptors.request.use((request) => {
  if (currentToken) {
    request.headers.Authorization = `Bearer ${currentToken}`;
  }

  return request;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Token expirado ou inválido: avisa o App para voltar ao login.
    if (error.response?.status === 401 && currentToken) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }

    return Promise.reject(error);
  }
);

/** Mensagem de erro amigável a partir de uma resposta da API. */
export const getApiErrorMessage = (error, fallback) => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (!error.response) {
    return "Não foi possível conectar ao servidor. Verifique se o backend está rodando.";
  }

  return fallback;
};
