import axios from "axios";

export const SESSION_EXPIRED_EVENT = "clickhelp:session-expired";

let currentToken = null;

export const getApiToken = () => currentToken;

export const setApiToken = (token) => {
  currentToken = token || null;
};

/**
 * Endereço base da API, sempre terminando em "/api". Assim, cadastrar
 * VITE_API_URL só com o domínio (ex.: https://clickhelp-api.onrender.com)
 * não faz todas as chamadas darem "Rota não encontrada".
 */
export const resolveApiBaseUrl = (value) => {
  const url = (value || "/api").trim().replace(/\/+$/, "");
  return url.endsWith("/api") ? url : `${url}/api`;
};

export const api = axios.create({
  // Padrão "/api": o Vite repassa para o backend (ver vite.config.js).
  // Publicado no Netlify, VITE_API_URL aponta para a API no Render.
  baseURL: resolveApiBaseUrl(import.meta.env.VITE_API_URL),
  // O plano gratuito do Render "dorme" sem uso e leva até ~1 minuto para acordar.
  timeout: 70000,
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
