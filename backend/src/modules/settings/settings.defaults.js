// Configuração inicial de uma instalação nova. Cada empresa ajusta tudo isso
// na tela "Configurações" (somente administradores).
export const DEFAULT_SETTINGS = {
  branding: {
    appName: "ClickHELP",
    companyName: "",
    logoDataUrl: "",
    primaryColor: "#1ed4df",
    secondaryColor: "#1388d1",
  },
  catalog: {
    locations: ["Matriz"],
    categories: ["Hardware", "Software", "Rede e internet", "Acesso e senhas", "Impressoras", "Outros"],
    departments: ["Administrativo", "Atendimento", "Financeiro", "TI"],
  },
  sla: {
    workStartHour: 8,
    workEndHour: 18,
    workDays: [1, 2, 3, 4, 5],
    hoursByPriority: { alta: 8, media: 24, baixa: 48 },
  },
  holidays: {
    national: true,
    movable: [],
    extra: [],
  },
  routines: [],
};
