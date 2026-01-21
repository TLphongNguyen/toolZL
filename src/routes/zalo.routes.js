import { Router } from "express";
import {
  getZaloStatusHandler,
  getQrCode,
} from "../controllers/zalo.controller.js";

const router = Router();

router.get("/zalo/status", getZaloStatusHandler);
router.get("/qr", getQrCode);

export default router;

