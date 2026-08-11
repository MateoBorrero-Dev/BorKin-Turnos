import multer from "multer";
import { env } from "../config/env.js";

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    const accepted = ["image/png", "image/jpeg", "image/webp"];
    if (accepted.includes(file.mimetype)) callback(null, true);
    else callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  },
});
