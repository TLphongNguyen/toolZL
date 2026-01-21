import fs from "fs";
import path from "path";
import { UPLOAD_DIR } from "../config/constants.js";

export function ensureDir(dirPath = UPLOAD_DIR) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore
  }
}

export function isSafeResultFilename(filename) {
  return /^data_zalo_result_\d+\.xlsx$/.test(filename);
}

export function resolveUploadPath(filename) {
  return path.join(UPLOAD_DIR, filename);
}

