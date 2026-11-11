import { createContext, useContext } from "react";

export const SettingsContext = createContext(null);

/** Configurações da empresa (marca, cadastros, SLA...). Use dentro de <SettingsProvider>. */
export const useSettings = () => {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings precisa estar dentro de <SettingsProvider>.");
  }

  return context;
};
