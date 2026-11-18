import { Router } from "express";
import { ROLE_ADMIN } from "../../shared/roles.js";
import { blockDemoUser, requireAuth, requireRole } from "../auth/auth.middleware.js";
import { createUserHandler, getUsers, updateUserHandler } from "./users.controller.js";

const router = Router();

// Gestão de usuários: somente administradores (na demonstração, só para ver).
router.use(requireAuth, requireRole(ROLE_ADMIN));
router.get("/", getUsers);
router.post("/", blockDemoUser, createUserHandler);
router.patch("/:id", blockDemoUser, updateUserHandler);

export default router;
