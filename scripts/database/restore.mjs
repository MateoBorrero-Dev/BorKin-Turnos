import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import {
  capture, composeBaseArgs, dockerClearUploadsScript, loadEnvironmentFile, parseArgs, postgresEnvironment, renameWithRetry, repoRoot, run,
  uniqueSuffix, validateBackup,
} from "./backup-utils.mjs";

const args = parseArgs(process.argv.slice(2));
await loadEnvironmentFile(args);

function assertConfirmed() {
  if (!args.force) throw new Error("Restore cancelado: volvé a ejecutar con --force después de verificar origen y destino.");
}

function assertSafeTarget(target) {
  const resolved = path.resolve(target);
  const root = path.parse(resolved).root;
  const forbidden = new Set([root.toLowerCase(), repoRoot.toLowerCase(), os.homedir().toLowerCase()]);
  if (forbidden.has(resolved.toLowerCase())) throw new Error(`Destino de uploads demasiado amplio: ${resolved}`);
  return resolved;
}

async function restoreLocal(backup) {
  const databaseUrl = args["database-url"] ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL o --database-url es obligatorio.");
  const pgEnv = postgresEnvironment(databaseUrl);
  const parsed = new URL(databaseUrl);
  console.info(`Destino DB: ${parsed.hostname}:${parsed.port || "5432"}/${parsed.pathname.slice(1)}`);
  await run(process.env.PG_RESTORE_BIN || "pg_restore", [
    "--clean", "--if-exists", "--no-owner", "--no-privileges", "--exit-on-error", "--dbname", pgEnv.PGDATABASE, backup.dumpPath,
  ], { env: pgEnv });

  const configuredUploads = args.uploads ?? process.env.UPLOAD_DIR;
  const target = assertSafeTarget(configuredUploads
    ? path.resolve(args.uploads ? process.cwd() : path.join(repoRoot, "backend"), configuredUploads)
    : path.join(repoRoot, ".local/uploads"));
  const temporary = `${target}.restore-${uniqueSuffix()}`;
  const previous = `${target}.previous-${uniqueSuffix()}`;
  await mkdir(temporary, { recursive: true });
  await cp(backup.uploadRoot, temporary, { recursive: true, force: false });
  let hadPrevious = false;
  try {
    await renameWithRetry(target, previous);
    hadPrevious = true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await renameWithRetry(temporary, target);
    if (hadPrevious) await rm(previous, { recursive: true, force: true });
  } catch (error) {
    if (hadPrevious) await renameWithRetry(previous, target).catch(() => undefined);
    throw error;
  }
  console.info(`Uploads restaurados en ${target}`);
}

async function restoreDocker(backup) {
  const compose = composeBaseArgs(args);
  const dbUser = process.env.POSTGRES_USER;
  const dbName = process.env.POSTGRES_DB;
  if (!dbUser || !dbName) throw new Error("POSTGRES_USER y POSTGRES_DB son obligatorios en modo Docker.");
  const backendId = await capture("docker", [...compose, "ps", "-aq", "backend"], { env: process.env });
  if (!backendId) throw new Error("El contenedor backend debe existir para restaurar su volumen de uploads.");
  const running = await capture("docker", ["inspect", "--format", "{{.State.Running}}", backendId]);
  if (running === "true") throw new Error("Detené backend antes del restore para evitar escrituras concurrentes.");
  console.info(`Destino Docker: proyecto ${args["project-name"] ?? process.env.COMPOSE_PROJECT_NAME ?? "predeterminado"}, base ${dbName}.`);

  await new Promise((resolve, reject) => {
    const child = spawn("docker", [
      ...compose, "exec", "-T", "postgres", "pg_restore", "--clean", "--if-exists", "--no-owner", "--no-privileges",
      "--exit-on-error", "-U", dbUser, "-d", dbName,
    ], { env: process.env, windowsHide: true, stdio: ["pipe", "inherit", "inherit"] });
    import("node:fs").then(({ createReadStream }) => createReadStream(backup.dumpPath).pipe(child.stdin));
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`pg_restore Docker terminó con código ${code}.`)));
  });

  await run("docker", [
    ...compose, "run", "--rm", "--no-deps", "--entrypoint", "node", "backend", "-e",
    dockerClearUploadsScript(),
  ], { env: process.env });
  if (backup.files.length) await run("docker", ["cp", `${backup.uploadRoot}${path.sep}.`, `${backendId}:/data/uploads`]);
  console.info(`Uploads restaurados en el volumen del contenedor ${backendId.slice(0, 12)}.`);
}

async function main() {
  const source = args.source ?? args.positional[0];
  if (!source) throw new Error("Indicá el paquete con --source <carpeta> o como argumento posicional.");
  assertConfirmed();
  const backup = await validateBackup(source);
  console.info(`Backup validado: ${backup.source}`);
  console.info(`Creado: ${backup.manifest.createdAt}; versión: ${backup.manifest.application.version}.`);
  if (args.docker) await restoreDocker(backup);
  else await restoreLocal(backup);
  console.info("Restore completado. Ejecutá healthchecks y validación funcional antes de habilitar tráfico.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
