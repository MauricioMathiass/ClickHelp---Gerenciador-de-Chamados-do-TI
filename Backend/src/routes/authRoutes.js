import { Router } from "express";
import { getUsers, login, me, registerUser, updateUserHandler } from "../controllers/authController.js";
import { ROLE_ADMIN } from "../lib/roles.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();
const adminOnly = [requireAuth, requireRole(ROLE_ADMIN)];

router.post("/login", login);
router.get("/me", requireAuth, me);

// Gestão de usuários: somente administradores.
router.post("/register", ...adminOnly, registerUser);
router.get("/users", ...adminOnly, getUsers);
router.patch("/users/:id", ...adminOnly, updateUserHandler);

export default router;
