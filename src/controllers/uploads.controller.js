import { isSafeResultFilename, resolveUploadPath } from "../utils/file.js";

export function downloadResultFile(req, res) {
  const { filename } = req.params;

  if (!isSafeResultFilename(filename)) {
    return res.status(400).json({
      error: "Invalid filename",
    });
  }

  const filePath = resolveUploadPath(filename);

  res.download(filePath, filename, (err) => {
    if (err) {
      res.status(404).json({
        error: "File not found",
      });
    }
  });
}

