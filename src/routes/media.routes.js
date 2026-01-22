import { Router } from "express";
import { uploadMediaMiddleware, uploadBulkMediaMiddleware } from "../middleware/media-upload.middleware.js";
import { sendMediaToUser, processMediaBulk } from "../controllers/media.controller.js";

const router = Router();

// Test endpoint: Gửi media cho 1 user theo UUID
router.post("/api/test/send-media", uploadMediaMiddleware, sendMediaToUser);

// Bulk endpoint: Gửi media cho nhiều users từ file Excel
router.post("/api/process-media", uploadBulkMediaMiddleware, processMediaBulk);

export default router;

