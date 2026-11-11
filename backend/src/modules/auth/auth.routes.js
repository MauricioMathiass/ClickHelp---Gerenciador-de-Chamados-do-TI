import { Router } from "express";
import { login, me } from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";

const router = Router();

router.post("/login", login);
router.get("/me", requireAuth, me);

export default router;
