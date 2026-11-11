import { Router } from "express";
import authRoutes from "./authRoutes.js";
import chamadosRoutes from "./chamadosRoutes.js";
import notificationsRoutes from "./notificationsRoutes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "clickhelp-backend",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/chamados", chamadosRoutes);
router.use("/notifications", notificationsRoutes);

export default router;
