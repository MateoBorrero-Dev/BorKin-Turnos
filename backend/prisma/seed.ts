import { disconnectSeedClient, runProductionSeed } from "./seed-base.js";

runProductionSeed()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(disconnectSeedClient);
