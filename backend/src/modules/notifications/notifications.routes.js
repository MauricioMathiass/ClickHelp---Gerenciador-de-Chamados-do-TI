import { Router } from "express";
import { clearNotifications, getNotifications, readNotifications } from "./notifications.controller.js";
import { requireAuth } from "../auth/auth.middleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", getNotifications);
router.post("/read", readNotifications);
router.post("/clear", clearNotifications);

export default router;
