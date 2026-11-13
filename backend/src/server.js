import { config } from "./config/env.js";
import app from "./app.js";
import { closeDatabase, initDatabase } from "./shared/db/database.js";

const DATABASE_LABELS = {
  postgres: "PostgreSQL (DATABASE_URL)",
  embedded: "banco local embutido (defina DATABASE_URL para usar o PostgreSQL)",
};

try {
  const kind = await initDatabase();
  console.log(`[ClickHELP] Banco de dados: ${DATABASE_LABELS[kind]}`);
} catch (error) {
  console.error("[ClickHELP] Não foi possível conectar ao banco de dados:", error.message);
  process.exit(1);
}

const server = app.listen(config.port, () => {
  console.log(`ClickHELP Backend rodando em http://localhost:${config.port}`);
});

// Render, Docker e o Ctrl+C mandam um sinal antes de encerrar: termina as
// requisições em andamento e fecha o banco com calma.
const shutdown = () => {
  server.close(async () => {
    await closeDatabase().catch(() => {});
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
