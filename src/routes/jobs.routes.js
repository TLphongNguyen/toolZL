import { Router } from "express";
import {
  getJobStatus,
  pauseJob,
  resumeJob,
  cancelJob,
  setRetryDelay,
} from "../controllers/jobs.controller.js";

const router = Router();

router.get("/api/jobs/:id", getJobStatus);
router.post("/api/jobs/:id/pause", pauseJob);
router.post("/api/jobs/:id/resume", resumeJob);
router.post("/api/jobs/:id/cancel", cancelJob);
router.post("/api/jobs/:id/set-retry-delay", setRetryDelay);

export default router;
