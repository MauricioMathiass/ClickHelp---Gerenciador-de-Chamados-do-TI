import { Router } from "express";
import { login, me, registerUser } from "../controllers/authController.js";
import { ROLE_ADMIN } from "../lib/roles.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.post("/login", login);
router.get("/me", requireAuth, me);
// Somente administradores cadastram novos usuários.
router.post("/register", requireAuth, requireRole(ROLE_ADMIN), registerUser);

export default router;
