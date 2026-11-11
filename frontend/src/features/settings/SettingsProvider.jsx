import { useCallback, useEffect, useMemo, useState } from "react";
import { getPublicSettings, getSettings, saveSettings } from "./settingsService";
import { SettingsContext } from "./useSettings";

const DEFAULT_BRANDING = {
  appName: "ClickHELP",
  companyName: "",
  logoDataUrl: "",
  primaryColor: "#1ed4df",
  secondaryColor: "#1388d1",
};

const EMPTY_CATALOG = { locations: [], categories: [], departments: [] };

/** Aplica nome e cores da empresa na página (título da aba e variáveis do tema). */
const applyBranding = (branding) => {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", branding.primaryColor);
  root.style.setProperty("--brand-secondary", branding.secondaryColor);
  document.title = branding.companyName ? `${branding.appName} | ${branding.companyName}` : branding.appName;
};

/**
 * Carrega as configurações da empresa:
 * - a marca (nome, logo, cores) logo ao abrir, mesmo sem login;
 * - o restante (locais, categorias, SLA, rotinas...) depois do login.
 */
export function SettingsProvider({ isAuthenticated, children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [settings, setSettings] = useState(null);
  const [options, setOptions] = useState({ movableHolidays: [] });

  useEffect(() => {
    getPublicSettings()
      .then((data) => setBranding({ ...DEFAULT_BRANDING, ...data.branding }))
      .catch(() => {});
  }, []);

  const reload = useCallback(async () => {
    const data = await getSettings();
    setSettings(data.settings);
    setOptions(data.options ?? { movableHolidays: [] });
    setBranding({ ...DEFAULT_BRANDING, ...data.settings.branding });
    return data.settings;
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- busca ao entrar; o estado muda só após a resposta
      reload().catch(() => {});
    }
  }, [isAuthenticated, reload]);

  useEffect(() => {
    applyBranding(branding);
  }, [branding]);

  const save = useCallback(async (next) => {
    const saved = await saveSettings(next);
    setSettings(saved);
    setBranding({ ...DEFAULT_BRANDING, ...saved.branding });
    return saved;
  }, []);

  const value = useMemo(
    () => ({
      branding,
      settings: isAuthenticated ? settings : null,
      catalog: (isAuthenticated && settings?.catalog) || EMPTY_CATALOG,
      options,
      reload,
      save,
    }),
    [branding, settings, isAuthenticated, options, reload, save]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
