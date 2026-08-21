import { createWriteStream } from "node:fs";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  capture, composeBaseArgs, hashFile, listFiles, loadEnvironmentFile, parseArgs, postgresEnvironment, renameWithRetry, repoRoot, run, uniqueSuffix,
} from "./backup-utils.mjs";

const args = parseArgs(process.argv.slice(2));
await loadEnvironmentFile(args);
const backupParent = path.resolve(args.output ?? process.env.BACKUP_DIR ?? path.join(repoRoot, "backups"));
const stamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const name = `borkin-${stamp}-${uniqueSuffix()}`;
const staging = path.join(backupParent, `.${name}.partial`);
const destination = path.join(backupParent, name);

async function dumpDocker(target) {
  const compose = composeBaseArgs(args);
  const dbUser = process.env.POSTGRES_USER;
  const dbName = process.env.POSTGRES_DB;
  if (!dbUser || !dbName) throw new Error("POSTGRES_USER y POSTGRES_DB son obligatorios en modo Docker.");
  await new Promise((resolve, reject) => {
    const output = createWriteStream(target, { flags: "wx" });
    const child = spawn("docker", [...compose, "exec", "-T", "postgres", "pg_dump", "-U", dbUser, "-d", dbName, "-Fc"], {
      env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "inherit"],
    });
    let processFinished = false;
    let outputFinished = false;
    const complete = () => { if (processFinished && outputFinished) resolve(); };
    child.stdout.pipe(output);
    child.once("error", reject);
    output.once("error", reject);
    output.once("finish", () => { outputFinished = true; complete(); });
    child.once("exit", (code) => {
      if (code !== 0) reject(new Error(`pg_dump Docker terminó con código ${code}.`));
      else { processFinished = true; complete(); }
    });
  });
  const backendId = await capture("docker", [...compose, "ps", "-q", "backend"], { env: process.env });
  if (!backendId) throw new Error("No existe un contenedor backend para copiar uploads.");
  await run("docker", ["cp", `${backendId}:/data/uploads/.`, path.join(staging, "uploads")]);
  return { mode: "docker", host: "postgres", database: dbName };
}

async function dumpLocal(target) {
  const databaseUrl = args["database-url"] ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL o --database-url es obligatorio.");
  const pgEnv = postgresEnvironment(databaseUrl);
  await run(process.env.PG_DUMP_BIN || "pg_dump", ["-Fc", "--file", target], { env: pgEnv });
  const configuredUploads = args.uploads ?? process.env.UPLOAD_DIR;
  const uploadSource = configuredUploads
    ? path.resolve(args.uploads ? process.cwd() : path.join(repoRoot, "backend"), configuredUploads)
    : path.join(repoRoot, ".local/uploads");
  await cp(uploadSource, path.join(staging, "uploads"), { recursive: true, force: false }).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
  const parsed = new URL(databaseUrl);
  return { mode: "local", host: parsed.hostname, database: parsed.pathname.slice(1) };
}

async function main() {
  await mkdir(staging, { recursive: true });
  await mkdir(path.join(staging, "uploads"), { recursive: true });
  try {
    const dumpPath = path.join(staging, "database.dump");
    const database = args.docker ? await dumpDocker(dumpPath) : await dumpLocal(dumpPath);
    const dumpInfo = await stat(dumpPath);
    if (dumpInfo.size === 0) throw new Error("pg_dump generó un archivo vacío.");
    const uploadFiles = await listFiles(path.join(staging, "uploads"));
    const uploadManifest = [];
    for (const file of uploadFiles) uploadManifest.push({ path: file.relative, size: file.size, sha256: await hashFile(file.absolute) });
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
    const manifest = {
      format: "borkin-backup-v1",
      createdAt: new Date().toISOString(),
      application: { name: packageJson.name, version: packageJson.version },
      database: { ...database, format: "pg_dump-custom", size: dumpInfo.size, sha256: await hashFile(dumpPath) },
      uploads: { count: uploadManifest.length, size: uploadManifest.reduce((sum, file) => sum + file.size, 0), files: uploadManifest },
    };
    await writeFile(path.join(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    await renameWithRetry(staging, destination);
    console.info(`Backup completo creado en ${destination}`);
    console.info(`Base: ${dumpInfo.size} bytes. Uploads: ${manifest.uploads.count} archivos (${manifest.uploads.size} bytes).`);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
