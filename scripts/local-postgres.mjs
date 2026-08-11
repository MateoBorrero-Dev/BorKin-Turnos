import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = resolve(repositoryRoot, process.env.LOCAL_POSTGRES_DATA ?? ".local/postgres-data");
const logFile = resolve(repositoryRoot, process.env.LOCAL_POSTGRES_LOG ?? ".local/postgres.log");
const port = process.env.LOCAL_POSTGRES_PORT ?? "55432";
const host = "127.0.0.1";
const command = process.argv[2];

function executableName() {
  return process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl";
}

function findPgCtl() {
  const executable = executableName();
  const candidates = [];
  if (process.env.POSTGRES_BIN) candidates.push(join(resolve(process.env.POSTGRES_BIN), executable));

  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles;
    const postgresRoot = programFiles ? join(programFiles, "PostgreSQL") : undefined;
    if (postgresRoot && existsSync(postgresRoot)) {
      const clusterVersionFile = join(dataDirectory, "PG_VERSION");
      const clusterVersion = existsSync(clusterVersionFile) ? readFileSync(clusterVersionFile, "utf8").trim().split(".")[0] : undefined;
      const versions = readdirSync(postgresRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => (left === clusterVersion ? -1 : right === clusterVersion ? 1 : right.localeCompare(left, undefined, { numeric: true })));
      candidates.push(...versions.map((version) => join(postgresRoot, version, "bin", executable)));
    }
  }

  const lookup = spawnSync(process.platform === "win32" ? "where.exe" : "which", [executable], { encoding: "utf8", windowsHide: true });
  if (lookup.status === 0 && typeof lookup.stdout === "string") candidates.push(...lookup.stdout.split(/\r?\n/).filter(Boolean));

  return candidates.find((candidate) => existsSync(candidate));
}

function fail(message) {
  console.error(`[db] ${message}`);
  process.exitCode = 1;
}

function runPgCtl(pgCtl, args) {
  return spawnSync(pgCtl, ["-D", dataDirectory, ...args], { encoding: "utf8", windowsHide: true });
}

function startPgCtl(pgCtl) {
  return spawnSync(pgCtl, ["-D", dataDirectory, "-l", logFile, "-o", `-p ${port} -h ${host}`, "start", "-W"], { windowsHide: true, stdio: "ignore" });
}

function commandDetail(result, fallback) {
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  return stderr || stdout || result.error?.message || fallback;
}

function getStatus(pgCtl) {
  if (!existsSync(dataDirectory) || !existsSync(join(dataDirectory, "PG_VERSION"))) {
    return { state: "inaccessible", detail: `No existe un cluster local en ${dataDirectory}.` };
  }
  const result = runPgCtl(pgCtl, ["status"]);
  if (result.status === 0) return { state: "active", detail: commandDetail(result, "Cluster activo.") };
  if (result.status === 3) return { state: "stopped", detail: commandDetail(result, "Cluster detenido.") };
  return { state: "inaccessible", detail: commandDetail(result, "pg_ctl no pudo consultar el cluster.") };
}

function waitForActive(pgCtl) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (getStatus(pgCtl).state === "active") return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  return false;
}

const pgCtl = findPgCtl();
if (!pgCtl) {
  fail("PostgreSQL no está instalado o pg_ctl no fue encontrado. Configurá POSTGRES_BIN con la carpeta bin de PostgreSQL.");
} else if (!["start", "stop", "status", "ensure"].includes(command)) {
  fail("Uso: node scripts/local-postgres.mjs <start|stop|status|ensure>");
} else {
  const status = getStatus(pgCtl);
  if (command === "status") {
    const label = status.state === "active" ? "ACTIVA" : status.state === "stopped" ? "DETENIDA" : "INACCESIBLE";
    console.log(`[db] PostgreSQL local: ${label}`);
    console.log(`[db] Cluster: ${dataDirectory}`);
    console.log(`[db] Conexión: postgresql://127.0.0.1:${port}`);
    if (status.detail) console.log(`[db] ${status.detail}`);
    if (status.state === "inaccessible") process.exitCode = 1;
  } else if (command === "start" || command === "ensure") {
    if (status.state === "active") {
      console.log(`[db] PostgreSQL local ya está ACTIVA en ${host}:${port}.`);
    } else if (status.state === "inaccessible") {
      fail(status.detail);
    } else {
      mkdirSync(dirname(logFile), { recursive: true });
      const result = startPgCtl(pgCtl);
      if (result.status !== 0) fail(commandDetail(result, "No se pudo iniciar PostgreSQL local."));
      else if (!waitForActive(pgCtl)) fail(`PostgreSQL no quedó activa. Revisá ${logFile}.`);
      else console.log(`[db] PostgreSQL local iniciada en ${host}:${port}. Datos: ${dataDirectory}`);
    }
  } else if (command === "stop") {
    if (status.state === "stopped") {
      console.log("[db] PostgreSQL local ya está DETENIDA.");
    } else if (status.state === "inaccessible") {
      fail(status.detail);
    } else {
      const result = runPgCtl(pgCtl, ["stop", "-m", "fast"]);
      if (result.status !== 0) fail(commandDetail(result, "No se pudo detener PostgreSQL local."));
      else console.log("[db] PostgreSQL local detenida. Los datos se conservaron.");
    }
  }
}
