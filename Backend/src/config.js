import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

// O SLA usa horário comercial; fixa o fuso para não depender do servidor.
process.env.TZ = process.env.TZ || "America/Sao_Paulo";

const readSecret = () => {
  const secret = process.env.JWT_SECRET?.trim();

  if (secret && secret.length >= 32) {
    return secret;
  }

  if (process.env.NODE_ENV !== "test") {
    console.warn(
      "[ClickHELP] JWT_SECRET ausente ou curto (mínimo de 32 caracteres). " +
        "Usando um segredo temporario: todos precisarao entrar de novo quando o backend reiniciar."
    );
  }

  return crypto.randomBytes(48).toString("hex");
};

export const config = {
  port: Number(process.env.PORT) || 3001,
  frontendOrigins: process.env.FRONTEND_ORIGIN?.split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  jwtSecret: readSecret(),
  admin: {
    username: process.env.ADMIN_USERNAME?.trim() || "",
    password: process.env.ADMIN_PASSWORD?.trim() || "",
    name: process.env.ADMIN_NAME?.trim() || "Administrador",
    department: process.env.ADMIN_DEPARTMENT?.trim() || "Service Desk",
  },
};

if ((!config.admin.username || !config.admin.password) && process.env.NODE_ENV !== "test") {
  console.warn("[ClickHELP] ADMIN_USERNAME/ADMIN_PASSWORD não definidos no .env: o administrador inicial não poderá entrar.");
}
