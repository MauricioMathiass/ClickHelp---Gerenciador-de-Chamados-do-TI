import { config } from "./config/env.js";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { HttpError } from "./shared/http/httpError.js";
import routes from "./routes.js";

const app = express();

app.use(
  cors({
    origin: config.frontendOrigins?.length ? config.frontendOrigins : "http://localhost:5173",
  })
);
// As configurações aceitam um corpo maior por causa do logo (imagem em base64).
app.use("/api/settings", express.json({ limit: "600kb" }));
app.use(express.json({ limit: "100kb" }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use("/api", routes);

app.use((_req, res) => {
  res.status(404).json({ message: "Rota não encontrada." });
});

app.use((error, _req, res, _next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  // Corpo da requisição com JSON malformado ou grande demais.
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Corpo da requisição inválido." });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Requisição muito grande." });
  }

  console.error(error);
  return res.status(500).json({ message: "Erro interno do servidor." });
});

export default app;
