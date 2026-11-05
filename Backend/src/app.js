import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import routes from "./routes/index.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN?.split(",").map((item) => item.trim()) || true,
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.use("/api", routes);

app.use((_req, res) => {
  res.status(404).json({
    message: "Rota nao encontrada.",
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: "Erro interno do servidor.",
  });
});

export default app;
