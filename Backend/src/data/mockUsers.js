import "dotenv/config";

export const mockUsers = [
  {
    id: 1,
    username: process.env.ADMIN_USERNAME?.trim() || "clickhelp.admin",
    passwords: [process.env.ADMIN_PASSWORD?.trim() || "ClickHelp@2026!"],
    name: process.env.ADMIN_NAME?.trim() || "Administrador ClickHELP",
    role: process.env.ADMIN_ROLE?.trim() || "Administrador",
    department: process.env.ADMIN_DEPARTMENT?.trim() || "Service Desk",
  },
];
