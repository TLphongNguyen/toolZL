import path from "path";
import fs from "fs";
import pTimeout from "p-timeout";
import { getZaloApi, getZaloStatus, ThreadType } from "../services/zalo.service.js";
import { randomItem } from "../utils/random.js";
import { MESSAGE_TEMPLATES, DEFAULT_TIMEOUT_MS } from "../config/constants.js";
import { logInfo, logError, logSuccess } from "../utils/logger.js";

/**
 * Test controller: Gửi media files cho 1 user theo UUID
 * 
 * Request body:
 * - uuid: string (required) - UUID của người nhận
 * - timeout: number (optional) - Timeout cho request (ms)
 * 
 * Request files:
 * - media: File[] (required) - Các file media để gửi
 */
export async function sendMediaToUser(req, res) {
    try {
        // Validate Zalo API
        const zaloStatus = getZaloStatus();
        const zaloApi = getZaloApi();

        if (!zaloStatus.initialized || !zaloApi) {
            return res.status(400).json({
                success: false,
                message: "Zalo service chưa khởi tạo. Vui lòng quét QR code trước.",
            });
        }

        // Validate UUID
        const { uuid } = req.body;
        if (!uuid) {
            return res.status(400).json({
                success: false,
                message: "Thiếu UUID người nhận",
            });
        }

        // Validate media files
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng upload ít nhất 1 file media",
            });
        }

        // Get timeout
        let timeout = parseInt(req.body.timeout, 10);
        if (Number.isNaN(timeout)) timeout = DEFAULT_TIMEOUT_MS;

        // Random message from templates
        const message = randomItem(MESSAGE_TEMPLATES);

        // Get absolute paths to media files
        const mediaPaths = req.files.map((file) => path.resolve(file.path));

        // Debug: Check if files exist and build attachments with Buffer
        console.log("=== DEBUG FILE CHECK ===");
        const attachments = [];
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const filePath = mediaPaths[i];
            const exists = fs.existsSync(filePath);
            const stats = exists ? fs.statSync(filePath) : null;
            console.log(`File: ${filePath}`);
            console.log(`  Exists: ${exists}`);
            console.log(`  Size: ${stats ? stats.size : 'N/A'} bytes`);
            console.log(`  Mimetype: ${file.mimetype}`);

            if (exists) {
                // Read file as buffer and create AttachmentSource object
                const buffer = fs.readFileSync(filePath);
                const isImage = file.mimetype.startsWith('image/');

                // Get image dimensions if it's an image
                let width = 1920;
                let height = 1080;
                if (isImage) {
                    try {
                        const sizeOf = (await import('image-size')).default;
                        const dimensions = sizeOf(buffer);
                        width = dimensions.width || 1920;
                        height = dimensions.height || 1080;
                    } catch (e) {
                        console.log("  Error getting dimensions:", e.message);
                    }
                }

                const attachment = {
                    data: buffer,
                    filename: file.originalname || file.filename,
                    metadata: {
                        totalSize: stats.size,
                        width: width,
                        height: height,
                    }
                };
                console.log(`  Attachment object created: filename=${attachment.filename}, width=${width}, height=${height}`);
                attachments.push(attachment);
            }
        }
        console.log(`Total attachments: ${attachments.length}`);
        console.log("========================");

        logInfo("test_send_media_start", {
            uuid,
            mediaCount: attachments.length,
            mediaPaths,
            message,
            timeout,
        });

        // Build message object with buffer attachments
        const messageObj = {
            msg: message,
            attachments: attachments,
        };

        console.log("=== MESSAGE OBJECT ===");
        console.log(`msg: "${message}"`);
        console.log(`attachments count: ${attachments.length}`);
        attachments.forEach((a, i) => {
            console.log(`  [${i}] filename: ${a.filename}, size: ${a.metadata.totalSize}, dimensions: ${a.metadata.width}x${a.metadata.height}`);
        });
        console.log("======================");

        // Send message with attachments
        const result = await pTimeout(
            zaloApi.sendMessage(
                messageObj,
                uuid.toString(),
                ThreadType.User
            ),
            { milliseconds: timeout, message: "Timeout" }
        );

        // Log full result for debugging
        console.log("=== SEND MESSAGE RESULT ===");
        console.log("Result:", JSON.stringify(result, null, 2));
        console.log("Message result:", result?.message);
        console.log("Attachment result:", result?.attachment);
        console.log("===========================");

        logSuccess("test_send_media_success", {
            uuid,
            mediaCount: mediaPaths.length,
            result,
        });

        return res.json({
            success: true,
            message: "Gửi media thành công",
            data: {
                uuid,
                mediaCount: mediaPaths.length,
                mediaFiles: req.files.map((f) => f.filename),
                randomMessage: message,
                result,
                // Add more details
                messageResult: result?.message,
                attachmentResult: result?.attachment,
            },
        });
    } catch (error) {
        logError("test_send_media_failed", {
            error: error?.message || String(error),
            uuid: req.body?.uuid,
        });

        return res.status(500).json({
            success: false,
            message: `Lỗi gửi media: ${error.message}`,
            error: error?.message || String(error),
        });
    }
}

/**
 * Bulk controller: Gửi media files cho nhiều users từ file Excel
 * 
 * Request body:
 * - timeout: number (optional) - Timeout cho mỗi request (ms)
 * - retryDelay: number (optional) - Delay khi bị rate limit (ms)
 * 
 * Request files:
 * - file: Excel file với danh sách SĐT
 * - media: File[] - Các file media để gửi
 */
export async function processMediaBulk(req, res) {
    // Must import dynamically to avoid circular dependency
    const { createJob, updateJob } = await import("../services/job.service.js");
    const { countValidPhonesInMediaExcel, processMediaExcelFile } = await import("../services/media.service.js");
    const { resolveUploadPath } = await import("../utils/file.js");

    // Validate Excel file
    if (!req.files?.file || req.files.file.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Không có file Excel được tải lên",
        });
    }

    // Validate media files
    if (!req.files?.media || req.files.media.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Vui lòng upload ít nhất 1 file media",
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
    if (Number.isNaN(timeout)) timeout = 10000; // Default 10s for media
    timeout = Math.max(1000, Math.min(30000, timeout));

    let retryDelay = parseInt(req.body.retryDelay, 10);
    if (Number.isNaN(retryDelay) || retryDelay < 60000 || retryDelay > 3600000) {
        retryDelay = 20 * 60 * 1000; // Default 20 minutes
    }

    const excelFile = req.files.file[0];
    const mediaFiles = req.files.media;
    const filePath = excelFile.path;

    // Count valid phones
    let totalPhones = 0;
    let invalid = 0;
    try {
        const counted = countValidPhonesInMediaExcel({ filePath });
        totalPhones = counted.totalPhones;
        invalid = counted.invalid;

        logInfo("media_excel_file_counted", {
            totalPhones,
            invalid,
            mediaCount: mediaFiles.length,
        });
    } catch (error) {
        logError("media_excel_file_read_error", {
            error: error?.message || String(error),
        });
        return res.status(500).json({
            success: false,
            message: `Lỗi đọc file: ${error.message}`,
        });
    }

    // Create output file
    const outputFileName = `media_result_${Date.now()}.xlsx`;
    const outputFilePath = resolveUploadPath(outputFileName);

    const job = createJob({
        status: "pending",
        totalPhones,
        processed: 0,
        currentIndex: 0,
        currentPhone: null,
        downloadUrl: `/uploads/${outputFileName}`,
        retryDelay,
        mediaCount: mediaFiles.length,
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
    logInfo("media_excel_job_started", {
        jobId: job.id,
        totalPhones,
        invalid,
        timeout,
        outputFileName,
        mediaCount: mediaFiles.length,
    });

    processMediaExcelFile({
        filePath,
        timeout,
        zaloApi,
        ThreadType,
        jobId: job.id,
        outputFileName,
        outputFilePath,
        mediaFiles,
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
            logInfo("media_excel_job_finished", {
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
            logError("media_excel_job_failed_async", {
                jobId: job.id,
                error: error?.message || String(error),
            });
        });

    return res.json({
        success: true,
        message: "Job started",
        jobId: job.id,
        totalPhones,
        mediaCount: mediaFiles.length,
    });
}

