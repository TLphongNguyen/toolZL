import {
  DEFAULT_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
} from "../config/constants.js";
import {
  getZaloApi,
  getZaloStatus,
  ThreadType,
} from "../services/zalo.service.js";
import { createJob, updateJob } from "../services/job.service.js";
import { countValidPhonesInExcel, processExcelFile } from "../services/excel.service.js";
import { logInfo, logError } from "../utils/logger.js";

export async function processExcel(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Không có file được tải lên",
    });
  }

  const zaloStatus = getZaloStatus();
  const zaloApi = getZaloApi();

  if (!zaloStatus.initialized || !zaloApi) {
    return res.status(400).json({
      success: false,
      message: "Zalo service chưa khởi tạo. Vui lòng quét QR code trước.",
    });
  }

  let timeout = parseInt(req.body.timeout, 10);
  if (Number.isNaN(timeout)) timeout = DEFAULT_TIMEOUT_MS;
  timeout = Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, timeout));

  // NEW: Parse retry delay for rate limit handling
  let retryDelay = parseInt(req.body.retryDelay, 10);
  if (Number.isNaN(retryDelay) || retryDelay < 60000 || retryDelay > 3600000) {
    retryDelay = 20 * 60 * 1000; // Default 20 minutes
  }

  const filePath = req.file.path;

  // Prepare job (count total phones quickly)
  let totalPhones = 0;
  let invalid = 0;
  try {
    const counted = countValidPhonesInExcel({ filePath });
    totalPhones = counted.totalPhones;
    invalid = counted.invalid;

    logInfo("excel_file_counted", {
      totalPhones,
      invalid,
    });
  } catch (error) {
    logError("excel_file_read_error", {
      error: error?.message || String(error),
    });
    return res.status(500).json({
      success: false,
      message: `Lỗi đọc file: ${error.message}`,
    });
  }

  // Create output file early
  const outputFileName = `data_zalo_result_${Date.now()}.xlsx`;
  const { resolveUploadPath } = await import("../utils/file.js");
  const outputFilePath = resolveUploadPath(outputFileName);

  const job = createJob({
    status: "pending",
    totalPhones,
    processed: 0,
    currentIndex: 0,
    currentPhone: null,
    downloadUrl: `/uploads/${outputFileName}`,
    retryDelay, // NEW: Pass retry delay for rate limit handling
    stats: {
      total: 0,
      invalid,
      found: 0,
      notFound: 0,
      error: 0,
      sendMessageSuccess: 0,
      sendMessageFailed: 0,
    },
  });

  // Start background processing
  updateJob(job.id, { status: "running" });
  logInfo("excel_job_started", {
    jobId: job.id,
    totalPhones,
    invalid,
    timeout,
    outputFileName,
  });
  processExcelFile({
    filePath,
    timeout,
    zaloApi,
    ThreadType,
    jobId: job.id,
    outputFileName,
    outputFilePath,
    onProgress: ({ processed, currentIndex, currentPhone, stats }) => {
      updateJob(job.id, {
        processed,
        currentIndex,
        currentPhone,
        stats,
      });
    },
  })
    .then(({ stats, outputFileName }) => {
      updateJob(job.id, {
        status: "completed",
        stats,
        currentPhone: null,
        downloadUrl: `/uploads/${outputFileName}`,
      });
      logInfo("excel_job_finished", {
        jobId: job.id,
        outputFileName,
        stats,
      });
    })
    .catch((error) => {
      updateJob(job.id, {
        status: "failed",
        error: error?.message || String(error),
      });
      logError("excel_job_failed_async", {
        jobId: job.id,
        error: error?.message || String(error),
      });
    });

  return res.json({
    success: true,
    message: "Job started",
    jobId: job.id,
    totalPhones,
  });
}

