import express from "express";
import { Zalo, ThreadType } from "zca-js";
import multer from "multer";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// Serve static files from public directory
app.use(express.static("public"));

// Khởi tạo Zalo service
let zaloApi = null;
let zaloInitialized = false;


/* =======================
   Helper Functions
======================= */
function normalizeVietnamesePhoneNumber(input) {
    if (!input) return null;
    const normalized = String(input).replace(/\s+/g, "");
    if (!/^\d+$/.test(normalized)) return null;
    const phone = normalized.startsWith("0") ? normalized : `0${normalized}`;
    if (phone.length !== 10) return null;
    return phone;
}

function isVietnamesePhoneNumberValid(input) {
    const phone = normalizeVietnamesePhoneNumber(input);
    if (!phone) return false;
    return /^(03|05|07|08|09)\d{8}$/.test(phone);
}

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

const MESSAGE_TEMPLATES = [
    "Chào anh/chị 👋 Em xin phép được giới thiệu một sản phẩm/dịch vụ có thể phù hợp với anh/chị.",
    "Xin chào anh/chị 😊 Không biết hiện tại anh/chị có đang quan tâm đến giải pháp hỗ trợ kinh doanh online không ạ?",
    "Chào anh/chị! Em liên hệ để chia sẻ nhanh một thông tin hữu ích, mong không làm phiền anh/chị.",
    "Em chào anh/chị 👋 Bên em đang có chương trình hỗ trợ mới, không biết anh/chị có tiện trao đổi không ạ?",
    "Xin chào anh/chị, em là bên hỗ trợ khách hàng. Em xin phép gửi anh/chị một thông tin ngắn gọn nhé.",
];

async function initializeZalo() {
    try {
        const zalo = new Zalo({
            selfListen: false, // mặc định false, lắng nghe sự kiện của bản thân
            checkUpdate: true, // mặc định true, kiểm tra update
            logging: false, // mặc định true, bật/tắt log mặc định của thư viện
        });

        zaloApi = await zalo.loginQR({
            userAgent: "", // không bắt buộc
            qrPath: "./qr.png", // đường dẫn lưu QR, mặc định ./qr.png
        });

        zaloApi.listener.start(); // bắt đầu lắng nghe sự kiện
        zaloInitialized = true;
    } catch (error) {
        zaloInitialized = false;
    }
}


// Routes
app.get("/", (req, res) => {
    res.sendFile("index.html", { root: "public" });
});

app.get("/api", (req, res) => {
    res.json({
        status: "running",
        message: "Zalo Service Server",
        zaloInitialized: zaloInitialized
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        zaloInitialized: zaloInitialized,
        timestamp: new Date().toISOString()
    });
});

app.get("/zalo/status", (req, res) => {
    res.json({
        initialized: zaloInitialized,
        api: zaloApi ? "available" : "not available"
    });
});

app.get("/qr", (req, res) => {
    res.sendFile("qr.png", { root: "." }, (err) => {
        if (err) {
            res.status(404).json({
                error: "QR code not found",
                message: "QR code chưa được tạo hoặc hết hạn. Vui lòng tải lại trang."
            });
        }
    });
});

// Download file result
app.get("/uploads/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join("uploads", filename);

    // Validate filename to prevent directory traversal
    if (!filename.match(/^data_zalo_result_\d+\.xlsx$/)) {
        return res.status(400).json({
            error: "Invalid filename"
        });
    }

    res.download(filePath, filename, (err) => {
        if (err) {
            res.status(404).json({
                error: "File not found"
            });
        }
    });
});

// Upload và xử lý file Excel
app.post("/api/process-excel", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "Không có file được tải lên"
        });
    }

    if (!zaloInitialized || !zaloApi) {
        return res.status(400).json({
            success: false,
            message: "Zalo service chưa khởi tạo. Vui lòng quét QR code trước."
        });
    }

    try {
        const filePath = req.file.path;
        const timeout = parseInt(req.body.timeout) || 5000;
        
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(sheet["!ref"]);

        // Ensure uploads directory exists
        if (!fs.existsSync("uploads")) {
            fs.mkdirSync("uploads", { recursive: true });
        }

        const stats = {
            total: 0,
            invalid: 0,
            found: 0,
            notFound: 0,
            error: 0,
            sendMessageSuccess: 0,
            sendMessageFailed: 0
        };

        const resultCol = 2;
        const userNameCol = 3;
        const userIdCol = 4;
        const userPhoneCol = 5;
        const userAvatarCol = 6;
        const sendMessageResultCol = 7;

        // Xử lý từng row
        for (let r = 0; r <= range.e.r; r++) {
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

            try {
                const user = await zaloApi.findUser(phone);
                if (!user) {
                    stats.notFound++;
                    sheet[resultCell] = { t: "s", v: "Không tìm thấy" };
                    await sleep(2000);
                    continue;
                }

                stats.found++;

                // Lấy thông tin chi tiết của user
                const userName = user.name || user.displayName || user.zalo_name || "N/A";
                const uid = user.uid || user.globalId || user.userId || "N/A";
                const userPhone = user.phone || raw || "N/A";
                const userAvatar = user.avatar || user.avatarUrl || "N/A";

                // Ghi thông tin user vào Excel
                sheet[resultCell] = { t: "s", v: "Tìm thấy" };
                sheet[userNameCell] = { t: "s", v: userName };
                sheet[userIdCell] = { t: "s", v: String(uid) };
                sheet[userPhoneCell] = { t: "s", v: String(userPhone) };
                sheet[userAvatarCell] = { t: "s", v: userAvatar };

                if (!uid || uid === "N/A") {
                    stats.sendMessageFailed++;
                    sheet[sendResultCell] = { t: "s", v: "gửi tn thất bại" };
                    continue;
                }

                const message = randomItem(MESSAGE_TEMPLATES);

                try {
                    await new Promise(async (resolve, reject) => {
                        const timeoutId = setTimeout(() => {
                            reject(new Error('Timeout'));
                        }, timeout);

                        try {
                            await zaloApi.sendMessage(message, uid.toString(), ThreadType.User);
                            clearTimeout(timeoutId);
                            resolve();
                        } catch (err) {
                            clearTimeout(timeoutId);
                            reject(err);
                        }
                    });

                    stats.sendMessageSuccess++;
                    sheet[sendResultCell] = { t: "s", v: "gửi tn thành công" };
                } catch (err) {
                    stats.sendMessageFailed++;
                    sheet[sendResultCell] = { t: "s", v: "gửi tn thất bại" };
                }
            } catch (err) {
                stats.error++;
                sheet[resultCell] = { t: "s", v: "Không tìm thấy" };
            }

            await sleep(3000 + Math.random() * 2000);
        }

        // Update sheet range
        sheet["!ref"] = XLSX.utils.encode_range({
            s: range.s,
            e: { r: range.e.r, c: Math.max(range.e.c, sendMessageResultCol) }
        });

        // Save result file
        const outputFileName = `data_zalo_result_${Date.now()}.xlsx`;
        const outputFilePath = path.join("uploads", outputFileName);
        XLSX.writeFile(workbook, outputFilePath);

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            message: "Xử lý file thành công",
            stats: stats,
            downloadUrl: `/uploads/${outputFileName}`
        });

    } catch (error) {
        // Clean up uploaded file
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {}
        }

        res.status(500).json({
            success: false,
            message: `Lỗi xử lý file: ${error.message}`
        });
    }
});

// Khởi động server
app.listen(PORT, async () => {
    await initializeZalo();
});

// Xử lý lỗi không bắt được
process.on("unhandledRejection", (error) => {});

process.on("uncaughtException", (error) => {
    process.exit(1);
});