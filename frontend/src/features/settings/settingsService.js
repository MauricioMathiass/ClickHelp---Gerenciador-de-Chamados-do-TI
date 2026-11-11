import { api, getApiErrorMessage } from "../../shared/services/api";

/** Nome, logo e cores (disponível antes do login). */
export const getPublicSettings = async () => {
  const { data } = await api.get("/settings/public");
  return data;
};

/** Configuração completa + opções auxiliares (ex.: feriados móveis disponíveis). */
export const getSettings = async () => {
  const { data } = await api.get("/settings");
  return data;
};

export const saveSettings = async (settings) => {
  try {
    const { data } = await api.put("/settings", settings);
    return data.settings;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Não foi possível salvar as configurações."));
  }
};
