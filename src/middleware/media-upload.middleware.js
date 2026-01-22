import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure storage for media files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, "../../uploads/media");
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

// File filter to accept only images and videos
const fileFilter = (req, file, cb) => {
    const allowedImageTypes = /jpeg|jpg|png|gif/;
    const allowedVideoTypes = /mp4|mov|avi/;
    const extname = path.extname(file.originalname).toLowerCase().slice(1);

    if (allowedImageTypes.test(extname) || allowedVideoTypes.test(extname)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif) hoặc video (mp4, mov, avi)"
            ),
            false
        );
    }
};

// Multer instance for media upload (max 10 files, 50MB each)
export const uploadMediaMiddleware = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 10,
    },
}).array("media", 10);

// Bulk upload middleware for Excel + Media files
const bulkFileFilter = (req, file, cb) => {
    const allowedImageTypes = /jpeg|jpg|png|gif/;
    const allowedVideoTypes = /mp4|mov|avi/;
    const allowedExcelTypes = /xlsx|xls/;
    const extname = path.extname(file.originalname).toLowerCase().slice(1);

    if (file.fieldname === 'file') {
        // Excel file
        if (allowedExcelTypes.test(extname)) {
            cb(null, true);
        } else {
            cb(new Error("File Excel phải có định dạng .xlsx hoặc .xls"), false);
        }
    } else if (file.fieldname === 'media') {
        // Media files
        if (allowedImageTypes.test(extname) || allowedVideoTypes.test(extname)) {
            cb(null, true);
        } else {
            cb(new Error("Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif) hoặc video (mp4, mov, avi)"), false);
        }
    } else {
        cb(null, true);
    }
};

export const uploadBulkMediaMiddleware = multer({
    storage: storage,
    fileFilter: bulkFileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 11, // 1 Excel + 10 media files
    },
}).fields([
    { name: 'file', maxCount: 1 },
    { name: 'media', maxCount: 10 }
]);

