import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { dockerClearUploadsScript, hashFile, safeRelative, validateBackup } from "./backup-utils.mjs";

test("safeRelative rechaza traversal y rutas absolutas", () => {
  assert.throws(() => safeRelative("../secreto"), /Ruta no segura/);
  assert.throws(() => safeRelative("/etc/passwd"), /Ruta no segura/);
  assert.equal(safeRelative("business/logo.webp"), "business/logo.webp");
});

test("dockerClearUploadsScript conserva el punto de montaje y elimina sólo sus hijos", () => {
  const script = dockerClearUploadsScript();
  assert.match(script, /readdirSync\(root\)/);
  assert.match(script, /rmSync\(p\.join\(root,entry\)/);
  assert.doesNotMatch(script, /rmSync\('\/data\/uploads'/);
  assert.throws(() => dockerClearUploadsScript("/"), /no seguro/);
});

test("validateBackup comprueba hashes e inventario", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "borkin-backup-test-"));
  try {
    await mkdir(path.join(root, "uploads/business"), { recursive: true });
    await writeFile(path.join(root, "database.dump"), "dump-real");
    await writeFile(path.join(root, "uploads/business/logo.webp"), "imagen-real");
    const dumpHash = await hashFile(path.join(root, "database.dump"));
    const uploadHash = await hashFile(path.join(root, "uploads/business/logo.webp"));
    await writeFile(path.join(root, "manifest.json"), JSON.stringify({
      format: "borkin-backup-v1",
      application: { version: "0.1.0" },
      database: { sha256: dumpHash },
      uploads: { files: [{ path: "business/logo.webp", size: 11, sha256: uploadHash }] },
    }));
    await validateBackup(root);
    await writeFile(path.join(root, "uploads/business/logo.webp"), "alterada");
    await assert.rejects(validateBackup(root), /inválido o alterado/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
