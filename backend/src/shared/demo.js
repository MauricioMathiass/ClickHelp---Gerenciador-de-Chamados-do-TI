import { ROLE_ADMIN, ROLE_ANALISTA, ROLE_USUARIO } from "./roles.js";

/**
 * Modo demonstração (DEMO_MODE=true): a tela de login ganha botões para entrar
 * com um perfil de exemplo, sem senha. Lido a cada uso para valer o ambiente atual.
 */
export const isDemoMode = () => process.env.DEMO_MODE?.trim().toLowerCase() === "true";

/** Perfis que o visitante pode escolher na tela de login. */
export const DEMO_ACCOUNTS = {
  usuario: {
    username: "demo.usuario",
    name: "Paula Ribeiro",
    role: ROLE_USUARIO,
    department: "Financeiro",
  },
  analista: {
    username: "demo.analista",
    name: "Lucas Andrade",
    role: ROLE_ANALISTA,
    department: "TI",
  },
  administrador: {
    username: "demo.admin",
    name: "Renata Costa",
    role: ROLE_ADMIN,
    department: "TI",
  },
};

/** Pessoas de exemplo que só aparecem como solicitantes dos chamados fictícios. */
export const DEMO_REQUESTERS = {
  carlos: { username: "demo.carlos", name: "Carlos Mendes", role: ROLE_USUARIO, department: "Atendimento" },
  juliana: {
    username: "demo.juliana",
    name: "Juliana Prado",
    role: ROLE_USUARIO,
    department: "Administrativo",
  },
};

export const DEMO_USERNAMES = [...Object.values(DEMO_ACCOUNTS), ...Object.values(DEMO_REQUESTERS)].map(
  (account) => account.username
);

export const isDemoUser = (user) => DEMO_USERNAMES.includes(String(user?.username ?? "").toLowerCase());
