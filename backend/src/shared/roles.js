export const ROLE_ADMIN = "Administrador";
export const ROLE_ANALISTA = "Analista de TI";
export const ROLE_USUARIO = "Usuario";

export const VALID_ROLES = [ROLE_ADMIN, ROLE_ANALISTA, ROLE_USUARIO];

/** Perfis que atendem chamados (Painel TI). */
export const TI_ROLES = [ROLE_ADMIN, ROLE_ANALISTA];

export const isTiRole = (role) => TI_ROLES.includes(role);
