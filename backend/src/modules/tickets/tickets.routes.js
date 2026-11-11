import { Router } from "express";
import { createChamadoHandler, getChamados, updateChamadoHandler } from "./tickets.controller.js";
import { TI_ROLES } from "../../shared/roles.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", getChamados);
router.post("/", createChamadoHandler);
// Apenas a equipe de TI atualiza status e resposta.
router.patch("/:id", requireRole(...TI_ROLES), updateChamadoHandler);

export default router;
