import XLSX from "xlsx";
import PQueue from "p-queue";
import pTimeout from "p-timeout";
import { randomItem } from "../utils/random.js";
import {
  isVietnamesePhoneNumberValid,
  normalizeVietnamesePhoneNumber,
} from "../utils/phone.js";
import {
  MESSAGE_TEMPLATES,
  UPLOAD_DIR,
} from "../config/constants.js";
import { ensureDir, safeUnlink, resolveUploadPath } from "../utils/file.js";
import {
  ZALO_QUEUE_CONCURRENCY,
  ZALO_QUEUE_INTERVAL_CAP,
  ZALO_QUEUE_INTERVAL,
} from "../config/queue.js";
import {
  logInfo,
  logError,
  startJob,
  endJob,
  logSuccess,
  logFindUserFailed,
  logSendMessageFailed,
} from "../utils/logger.js";
import { getJob, updateJob, autoPauseJob, shouldAutoResume } from "./job.service.js";

export function countValidPhonesInExcel({ filePath }) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const range = XLSX.utils.decode_range(sheet["!ref"]);

  let totalPhones = 0;
  let invalid = 0;

  for (let r = 0; r <= range.e.r; r++) {
    const phoneCell = XLSX.utils.encode_cell({ r, c: 1 });
    const raw = sheet[phoneCell]?.v ?? "";

    if (!raw) continue;

    if (!isVietnamesePhoneNumberValid(raw)) {
      invalid++;
      continue;
    }

    totalPhones++;
  }

  return { totalPhones, invalid };
}

async function waitForResume(jobId) {
  while (true) {
    const job = getJob(jobId);
    if (!job || job.status === "cancelled") {
      return false; // cancelled
    }

    // Auto-resume check: if paused and timeout has passed
    if (job.status === "paused" && shouldAutoResume(jobId)) {
      updateJob(jobId, {
        status: 'running',
        pausedUntil: null,
        pauseReason: null,
        warning: null  // Clear warning
      });
      return true;
    }

    if (job.status === "running") {
      return true; // resumed
    }
    // paused - wait
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

function shouldAutoPauseOnError(error) {
  const msg = (error?.message || String(error)).toLowerCase();
  return (
    msg.includes("tìm số điện thoại quá nhiều lần") ||
    msg.includes("quá nhiều lần trong 1 giờ") ||
    msg.includes("hoạt động bất thường") ||
    msg.includes("vượt quá số request cho phép") ||
    msg.includes("vượt quá số request") ||
    msg.includes("request cho phép")
  );
}

function findLastProcessedRow(sheet, range, resultCol) {
  // Duyệt từ dòng cuối cùng lên đầu (bỏ qua dòng header r=0)
  for (let r = range.e.r; r > 0; r--) {
    const resultCell = XLSX.utils.encode_cell({ r, c: resultCol });
    const resultValue = sheet[resultCell]?.v;

    // Nếu có giá trị ở cột kết quả (không rỗng), dòng này đã được xử lý
    if (resultValue !== undefined && resultValue !== null && resultValue !== "") {
      return r;
    }
  }

  // Không tìm thấy dòng nào đã xử lý
  return -1;
}

export async function processExcelFile({
  filePath,
  timeout,
  zaloApi,
  ThreadType,
  onProgress,
  jobId,
  outputFileName,
  outputFilePath,
}) {
  ensureDir(UPLOAD_DIR);

  try {
    // Initialize logging for this job
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(sheet["!ref"]);

    // Count invalid phones to pass to startJob
    let invalidPhoneCount = 0;
    for (let r = 0; r <= range.e.r; r++) {
      const phoneCell = XLSX.utils.encode_cell({ r, c: 1 });
      const raw = sheet[phoneCell]?.v ?? "";
      if (raw && !isVietnamesePhoneNumberValid(raw)) {
        invalidPhoneCount++;
      }
    }

    // Calculate total valid phones
    const totalValidPhones = (range.e.r + 1) - invalidPhoneCount;

    if (jobId) {
      startJob(jobId, totalValidPhones, invalidPhoneCount);
    }

    const stats = {
      total: 0,
      invalid: 0,
      found: 0,
      notFound: 0,
      error: 0,
      sendMessageSuccess: 0,
      sendMessageFailed: 0,
    };

    const resultCol = 2;
    const userNameCol = 3;
    const userIdCol = 4;
    const userPhoneCol = 5;
    const userAvatarCol = 6;
    const sendMessageResultCol = 7;

    const queue = new PQueue({
      concurrency: ZALO_QUEUE_CONCURRENCY,
      intervalCap: ZALO_QUEUE_INTERVAL_CAP,
      interval: ZALO_QUEUE_INTERVAL,
      autoStart: true,
    });

    // Tìm dòng cuối cùng đã được xử lý
    const lastProcessedRow = findLastProcessedRow(sheet, range, resultCol);
    const startRow = lastProcessedRow >= 0 ? lastProcessedRow + 1 : 0;

    // Tính số lượng số điện thoại hợp lệ đã được xử lý (để cập nhật progress bar)
    let processedValidPhones = 0;
    if (lastProcessedRow >= 0) {
      // Đếm số điện thoại hợp lệ từ dòng 0 đến lastProcessedRow
      for (let r = 0; r <= lastProcessedRow; r++) {
        const phoneCell = XLSX.utils.encode_cell({ r, c: 1 });
        const raw = sheet[phoneCell]?.v ?? "";
        if (raw && isVietnamesePhoneNumberValid(raw)) {
          processedValidPhones++;
        }
      }

      logInfo("excel_resume_detected", {
        lastProcessedRow,
        startRow,
        processedValidPhones,
        totalRows: range.e.r + 1,
      });
    }

    let batchCount = 0;
    const BATCH_SIZE = 5;

    for (let r = startRow; r <= range.e.r; r++) {
      stats.total++;

      const phoneCell = XLSX.utils.encode_cell({ r, c: 1 });
      const raw = sheet[phoneCell]?.v ?? "";

      const resultCell = XLSX.utils.encode_cell({ r, c: resultCol });
      const userNameCell = XLSX.utils.encode_cell({ r, c: userNameCol });
      const userIdCell = XLSX.utils.encode_cell({ r, c: userIdCol });
      const userPhoneCell = XLSX.utils.encode_cell({ r, c: userPhoneCol });
      const userAvatarCell = XLSX.utils.encode_cell({ r, c: userAvatarCol });
      const sendResultCell = XLSX.utils.encode_cell({ r, c: sendMessageResultCol });

      if (!isVietnamesePhoneNumberValid(raw)) {
        stats.invalid++;
        sheet[resultCell] = { t: "s", v: "Định dạng sđt không đúng" };
        continue;
      }

      const phone = normalizeVietnamesePhoneNumber(raw);

      // Check job status before processing
      if (jobId) {
        const job = getJob(jobId);
        if (!job) {
          break; // job deleted
        }
        if (job.status === "cancelled") {
          break;
        }
        if (job.status === "paused") {
          const resumed = await waitForResume(jobId);
          if (!resumed) {
            break; // cancelled while paused
          }
        }
      }

      processedValidPhones++;

      if (typeof onProgress === "function") {
        onProgress({
          processed: processedValidPhones,
          currentIndex: processedValidPhones,
          currentPhone: phone,
          stats,
        });
      }

      await queue.add(async () => {
        try {
          const user = await zaloApi.findUser(phone);
          if (!user) {
            stats.notFound++;
            sheet[resultCell] = { t: "s", v: "Không tìm thấy" };
            return;
          }

          stats.found++;

          const userName = user.name || user.displayName || user.zalo_name || "N/A";
          const uid = user.uid || user.globalId || user.userId || "N/A";
          const userPhone = user.phone || raw || "N/A";
          const userAvatar = user.avatar || user.avatarUrl || "N/A";

          sheet[resultCell] = { t: "s", v: "Tìm thấy" };
          sheet[userNameCell] = { t: "s", v: userName };
          sheet[userIdCell] = { t: "s", v: String(uid) };
          sheet[userPhoneCell] = { t: "s", v: String(userPhone) };
          sheet[userAvatarCell] = { t: "s", v: userAvatar };

          if (!uid || uid === "N/A") {
            stats.sendMessageFailed++;
            sheet[sendResultCell] = { t: "s", v: "gửi tn thất bại" };
            return;
          }

          const message = randomItem(MESSAGE_TEMPLATES);

          try {
            await pTimeout(
              zaloApi.sendMessage(message, uid.toString(), ThreadType.User),
              { milliseconds: timeout, message: "Timeout" }
            );

            stats.sendMessageSuccess++;
            sheet[sendResultCell] = { t: "s", v: "gửi tn thành công" };
            logSuccess(phone, {
              name: userName,
              avatar: userAvatar,
              message,
              processingTime: `${timeout}ms`,
            });
          } catch (err) {
            stats.sendMessageFailed++;
            const errorMsg = (err?.message || String(err))
              .replace(/\r?\n/g, " ")
              .trim();
            sheet[sendResultCell] = { t: "s", v: errorMsg };

            logSendMessageFailed(phone, err?.message || String(err), uid);
          }
        } catch (err) {
          stats.error++;
          const errorMsg = (err?.message || String(err))
            .replace(/\r?\n/g, " ")
            .trim();
          sheet[resultCell] = { t: "s", v: errorMsg };

          logFindUserFailed(phone, err?.message || String(err));

          // Auto-pause on rate limit error
          if (shouldAutoPauseOnError(err) && jobId) {
            const job = getJob(jobId);
            if (job && job.status === 'running') {
              const delayMs = job.retryDelay || (20 * 60 * 1000);
              const delayMinutes = Math.floor(delayMs / 60000);

              autoPauseJob(jobId, 'rate_limit', delayMs);
              updateJob(jobId, {
                warning: `⏸️ Tạm dừng do rate limit. Sẽ tự động tiếp tục sau ${delayMinutes} phút.`
              });
            }
          }
        }
      });

      // Batch write every BATCH_SIZE valid phones
      batchCount++;
      if (batchCount >= BATCH_SIZE && jobId) {
        const job = getJob(jobId);
        if (job && (job.status === "running" || job.status === "paused")) {
          sheet["!ref"] = XLSX.utils.encode_range({
            s: range.s,
            e: { r: range.e.r, c: Math.max(range.e.c, sendMessageResultCol) },
          });
          XLSX.writeFile(workbook, outputFilePath);
          batchCount = 0;
        }
      }
    }

    await queue.onIdle();

    // Final check for cancelled
    if (jobId) {
      const job = getJob(jobId);
      if (!job || job.status === "cancelled") {
        // Flush file before exiting
        sheet["!ref"] = XLSX.utils.encode_range({
          s: range.s,
          e: { r: range.e.r, c: Math.max(range.e.c, sendMessageResultCol) },
        });
        XLSX.writeFile(workbook, outputFilePath);
        throw new Error("Job cancelled");
      }
    }

    if (typeof onProgress === "function") {
      onProgress({
        processed: processedValidPhones,
        currentIndex: processedValidPhones,
        currentPhone: null,
        stats,
      });
    }

    // Final write
    sheet["!ref"] = XLSX.utils.encode_range({
      s: range.s,
      e: { r: range.e.r, c: Math.max(range.e.c, sendMessageResultCol) },
    });
    XLSX.writeFile(workbook, outputFilePath);

    safeUnlink(filePath);

    if (jobId) {
      endJob();
    }

    logInfo("excel_job_completed", {
      outputFileName,
      stats,
    });

    return { stats, outputFileName };
  } catch (error) {
    safeUnlink(filePath);
    if (jobId) {
      endJob();
    }
    logError("excel_job_failed", {
      error: error?.message || String(error),
    });
    throw error;
  }
}

