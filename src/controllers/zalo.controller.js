import { getZaloStatus } from "../services/zalo.service.js";

export function getZaloStatusHandler(req, res) {
  const status = getZaloStatus();
  res.json({
    initialized: status.initialized,
    api: status.hasApi ? "available" : "not available",
  });
}

export function getQrCode(req, res) {
  res.sendFile("qr.png", { root: "." }, (err) => {
    if (err) {
      res.status(404).json({
        error: "QR code not found",
        message: "QR code chưa được tạo hoặc hết hạn. Vui lòng tải lại trang.",
      });
    }
  });
}

