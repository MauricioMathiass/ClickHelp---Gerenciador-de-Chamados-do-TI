import { config } from "./config/env.js";
import app from "./app.js";
import { ensureRoutineTickets } from "./modules/tickets/routines.service.js";

const ROUTINE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Cria as rotinas do dia e encerra as antigas mesmo que ninguém acesse o sistema.
const runRoutineCheck = () =>
  ensureRoutineTickets().catch((error) => {
    console.error("[ClickHELP] Falha ao atualizar as rotinas:", error);
  });

app.listen(config.port, () => {
  console.log(`ClickHELP Backend rodando em http://localhost:${config.port}`);
  runRoutineCheck();
  setInterval(runRoutineCheck, ROUTINE_CHECK_INTERVAL_MS);
});
