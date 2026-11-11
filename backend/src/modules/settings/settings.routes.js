import { Router } from "express";
import { ROLE_ADMIN } from "../../shared/roles.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { getAll, getPublic, update } from "./settings.controller.js";

const router = Router();

// Nome, logo e cores: a tela de login precisa antes de qualquer login.
router.get("/public", getPublic);
router.get("/", requireAuth, getAll);
router.put("/", requireAuth, requireRole(ROLE_ADMIN), update);

export default router;
