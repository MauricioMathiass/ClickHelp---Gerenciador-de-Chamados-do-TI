import { Router } from "express";
import authRoutes from "./modules/auth/auth.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";
import ticketsRoutes from "./modules/tickets/tickets.routes.js";
import usersRoutes from "./modules/users/users.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "clickhelp-backend",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/chamados", ticketsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/settings", settingsRoutes);

export default router;
