import { Router } from "express";
import { demoLogin, login, me } from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";

const router = Router();

router.post("/login", login);
router.post("/demo", demoLogin);
router.get("/me", requireAuth, me);

export default router;
