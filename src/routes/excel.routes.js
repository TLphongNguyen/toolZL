import { Router } from "express";
import { uploadExcelMiddleware } from "../middleware/upload.middleware.js";
import { processExcel } from "../controllers/excel.controller.js";

const router = Router();

router.post("/api/process-excel", uploadExcelMiddleware, processExcel);

export default router;

