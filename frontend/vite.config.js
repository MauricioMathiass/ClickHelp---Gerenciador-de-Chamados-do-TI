import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // O navegador chama "/api" no mesmo endereço do frontend e o Vite repassa
  // para o backend. Assim funciona em qualquer lugar (máquina local,
  // GitHub Codespaces, servidor) sem depender de "localhost" no navegador.
  const proxy = {
    "/api": {
      target: env.API_PROXY_TARGET || "http://localhost:3001",
      changeOrigin: true,
    },
  };

  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  };
});
