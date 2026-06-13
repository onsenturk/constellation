/** Central runtime configuration. Loads .env from the repo root. */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: resolve(repoRoot, ".env") });

const flag = (v: string | undefined): boolean => /^(1|true|yes)$/i.test((v ?? "").trim());

export const config = {
  repoRoot,
  port: Number(process.env.PORT ?? 3001),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  dataDir: process.env.DATA_DIR ?? resolve(repoRoot, "sample-data"),
  graphPath: process.env.GRAPH_PATH ?? resolve(repoRoot, "data/graph.json"),
  foundry: {
    live: flag(process.env.FOUNDRY_LIVE),
    endpoint: process.env.AZURE_AI_FOUNDRY_ENDPOINT ?? "",
    project: process.env.AZURE_AI_FOUNDRY_PROJECT ?? "",
    deployment: process.env.AZURE_AI_FOUNDRY_DEPLOYMENT ?? "",
    apiVersion: process.env.AZURE_AI_FOUNDRY_API_VERSION ?? "2024-10-21",
    scope: process.env.AZURE_AI_FOUNDRY_SCOPE ?? "https://cognitiveservices.azure.com/.default",
  },
  workIq: { live: flag(process.env.WORKIQ_LIVE) },
  fabricIq: { live: flag(process.env.FABRICIQ_LIVE) },
} as const;
