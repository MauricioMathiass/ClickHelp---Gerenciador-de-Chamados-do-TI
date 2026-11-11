import { Router } from "express";
import { ROLE_ADMIN } from "../../shared/roles.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { createUserHandler, getUsers, updateUserHandler } from "./users.controller.js";

const router = Router();

// Gestão de usuários: somente administradores.
router.use(requireAuth, requireRole(ROLE_ADMIN));
router.get("/", getUsers);
router.post("/", createUserHandler);
router.patch("/:id", updateUserHandler);

export default router;
