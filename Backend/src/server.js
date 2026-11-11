import { config } from "./config.js";
import app from "./app.js";

app.listen(config.port, () => {
  console.log(`ClickHELP Backend rodando em http://localhost:${config.port}`);
});
