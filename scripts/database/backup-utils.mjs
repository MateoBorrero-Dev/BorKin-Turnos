import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir, readFile, realpath, rename } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseEnv } from "node:util";

export const repoRoot = path.resolve(import.meta.dirname, "../..");

export function parseArgs(argv) {
  const result = { positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) { result.positional.push(value); continue; }
    const key = value.slice(2);
    if (["docker", "force"].includes(key)) result[key] = true;
    else {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) throw new Error(`Falta el valor de --${key}.`);
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

export function composeBaseArgs(args) {
  const values = ["compose"];
  const envFile = args["env-file"] ?? process.env.COMPOSE_ENV_FILE;
  if (envFile) values.push("--env-file", path.resolve(envFile));
  if (args["project-name"]) values.push("--project-name", args["project-name"]);
  return values;
}

export async function loadEnvironmentFile(args) {
  const envFile = args["env-file"] ?? process.env.COMPOSE_ENV_FILE;
  if (!envFile) return;
  const parsed = parseEnv(await readFile(path.resolve(envFile), "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: true, ...options });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} terminó con código ${code}.`)));
  });
}

export async function capture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `${command} terminó con código ${code}.`)));
  });
}

export async function hashFile(file) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("end", resolve);
    stream.once("error", reject);
  });
  return hash.digest("hex");
}

export function safeRelative(relative) {
  const normalized = relative.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("../") || normalized === "..") {
    throw new Error(`Ruta no segura en backup: ${relative}`);
  }
  return normalized;
}

export async function listFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = safeRelative(path.relative(root, absolute));
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink()) throw new Error(`No se admiten enlaces simbólicos en uploads: ${relative}`);
      if (metadata.isDirectory()) await visit(absolute);
      else if (metadata.isFile()) files.push({ absolute, relative, size: metadata.size });
      else throw new Error(`Tipo de archivo no admitido en uploads: ${relative}`);
    }
  }
  try { await visit(root); }
  catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

export async function validateBackup(source) {
  const sourcePath = path.resolve(source);
  const sourceReal = await realpath(sourcePath);
  const manifest = JSON.parse(await readFile(path.join(sourceReal, "manifest.json"), "utf8"));
  if (manifest.format !== "borkin-backup-v1") throw new Error("Formato de backup no compatible.");
  const dumpPath = path.join(sourceReal, "database.dump");
  const dumpInfo = await lstat(dumpPath);
  if (!dumpInfo.isFile() || dumpInfo.size === 0) throw new Error("database.dump falta o está vacío.");
  if (await hashFile(dumpPath) !== manifest.database.sha256) throw new Error("La firma SHA-256 de database.dump no coincide.");

  const uploadRoot = path.join(sourceReal, "uploads");
  const uploadInfo = await lstat(uploadRoot);
  if (!uploadInfo.isDirectory() || uploadInfo.isSymbolicLink()) throw new Error("La carpeta uploads del backup no es válida.");
  const files = await listFiles(uploadRoot);
  const expected = new Map((manifest.uploads.files ?? []).map((file) => [safeRelative(file.path), file]));
  if (files.length !== expected.size) throw new Error("El inventario de uploads no coincide con el manifiesto.");
  for (const file of files) {
    const record = expected.get(file.relative);
    if (!record || record.size !== file.size || record.sha256 !== await hashFile(file.absolute)) {
      throw new Error(`Upload inválido o alterado: ${file.relative}`);
    }
  }
  return { source: sourceReal, manifest, dumpPath, uploadRoot, files };
}

export function postgresEnvironment(databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") throw new Error("DATABASE_URL debe ser PostgreSQL.");
  return {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGDATABASE: parsed.pathname.slice(1),
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
  };
}

export function uniqueSuffix() { return randomUUID().slice(0, 8); }

export function dockerClearUploadsScript(directory = "/data/uploads") {
  if (!directory.startsWith("/") || directory === "/") throw new Error("Directorio de uploads Docker no seguro.");
  return `const f=require('node:fs');const p=require('node:path');const root=${JSON.stringify(directory)};for(const entry of f.readdirSync(root)){f.rmSync(p.join(root,entry),{recursive:true,force:true});}`;
}

export async function renameWithRetry(source, destination) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try { await rename(source, destination); return; }
    catch (error) {
      if (!["EPERM", "EBUSY", "EACCES"].includes(error?.code) || attempt === 7) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}
