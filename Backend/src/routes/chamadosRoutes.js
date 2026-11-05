import { Router } from "express";
import {
  createChamadoHandler,
  getChamados,
  updateChamadoHandler,
} from "../controllers/chamadosController.js";

const router = Router();

router.get("/", getChamados);
router.post("/", createChamadoHandler);
router.patch("/:id", updateChamadoHandler);

export default router;
