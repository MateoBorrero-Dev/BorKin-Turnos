import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

const baseDirectory = resolve(process.cwd(), env.UPLOAD_DIR);
const allowedFolders = new Set(["business", "employees"]);

function detectImage(buffer: Buffer): { extension: string; mime: string } | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { extension: ".png", mime: "image/png" };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: ".jpg", mime: "image/jpeg" };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { extension: ".webp", mime: "image/webp" };
  return null;
}

function safeLocalPath(publicUrl: string) {
  if (!publicUrl.startsWith("/uploads/")) return null;
  const localPath = resolve(baseDirectory, publicUrl.slice("/uploads/".length));
  const rel = relative(baseDirectory, localPath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || rel.split(sep).includes("..")) return null;
  return localPath;
}

export async function saveImage(buffer: Buffer, folder: "business" | "employees") {
  if (!allowedFolders.has(folder)) throw new ApiError(400, "Destino de archivo inválido.", "INVALID_UPLOAD_SCOPE");
  if (buffer.length > env.MAX_UPLOAD_BYTES) throw new ApiError(413, "La imagen supera el tamaño máximo permitido.", "FILE_TOO_LARGE");
  const image = detectImage(buffer);
  if (!image) throw new ApiError(400, "El archivo debe ser una imagen PNG, JPEG o WebP válida.", "INVALID_IMAGE");
  const directory = resolve(baseDirectory, folder);
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}${image.extension}`;
  await writeFile(resolve(directory, filename), buffer, { flag: "wx" });
  return `/uploads/${folder}/${filename}`;
}

export async function removeImage(publicUrl: string | null | undefined) {
  if (!publicUrl) return;
  const localPath = safeLocalPath(publicUrl);
  if (localPath) await rm(localPath, { force: true });
}

export async function validateStoredImage(publicUrl: string) {
  const localPath = safeLocalPath(publicUrl);
  if (!localPath) return false;
  try { return detectImage(await readFile(localPath)) !== null; } catch { return false; }
}

export const uploadsDirectory = baseDirectory;
