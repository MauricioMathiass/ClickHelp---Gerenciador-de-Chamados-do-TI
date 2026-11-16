// Mesmos valores de backend/src/shared/roles.js.
export const ROLE_ADMIN = "Administrador";
export const ROLE_ANALISTA = "Analista de TI";
export const ROLE_USUARIO = "Usuario";

/** Perfis que atendem chamados (Painel TI e Histórico). */
export const TI_ROLES = [ROLE_ADMIN, ROLE_ANALISTA];

export const ROLE_OPTIONS = [
  { value: ROLE_USUARIO, label: "Usuário" },
  { value: ROLE_ANALISTA, label: "Analista de TI" },
  { value: ROLE_ADMIN, label: "Administrador" },
];
