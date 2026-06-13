/**
 * Batch ingest: read the synthetic sample-data set and write data/graph.json.
 *
 *   npm run ingest
 *
 * Deterministic — re-running on unchanged data produces an identical file.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildGraph } from "../api/src/graph/build.js";
import {
  indexGraph,
  sharedRisks,
  sharedTopics,
  untrackedRepeatedRecs,
  openActionStats,
} from "../api/src/graph/patterns.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function rooted(p: string): string {
  return isAbsolute(p) ? p : join(rootDir, p);
}

const dataDir = rooted(process.env.DATA_DIR ?? "sample-data");
const graphPath = rooted(process.env.GRAPH_PATH ?? "data/graph.json");

console.log(`\n  Constellation ingest`);
console.log(`  source : ${dataDir}`);
console.log(`  output : ${graphPath}\n`);

const graph = buildGraph(dataDir);

mkdirSync(dirname(graphPath), { recursive: true });
writeFileSync(graphPath, JSON.stringify(graph, null, 2) + "\n", "utf8");

const idx = indexGraph(graph);
const counts = graph.nodes.reduce<Record<string, number>>((acc, n) => {
  acc[n.type] = (acc[n.type] ?? 0) + 1;
  return acc;
}, {});

console.log(`  nodes  : ${graph.nodes.length}  (${Object.entries(counts)
  .map(([k, v]) => `${k}:${v}`)
  .join("  ")})`);
console.log(`  links  : ${graph.links.length}`);
console.log(`  artifacts: ${graph.artifacts.length}\n`);

const risks = sharedRisks(graph, idx);
const topics = sharedTopics(graph, idx);
const untracked = untrackedRepeatedRecs(graph, idx);
const stats = openActionStats(graph);

console.log(`  Cross-customer patterns detected:`);
for (const r of risks) {
  console.log(`   • risk "${r.node.label}" shared by ${r.customerLabels.join(", ")}`);
}
for (const t of topics) {
  console.log(`   • topic "${t.node.label}" shared by ${t.customerLabels.join(", ")}`);
}
console.log(`\n  Repeated recommendations not yet tracked (${untracked.length}):`);
for (const u of untracked) {
  console.log(`   • "${u.node.label}" — ${u.customerLabels.join(" + ")}`);
}
console.log(`\n  Open actions: ${stats.count} (oldest ~${stats.oldestDays}d)\n`);

if (risks.length === 0 || untracked.length === 0) {
  console.warn("  ⚠ Expected cross-customer patterns were not found — check the data set.\n");
  process.exitCode = 1;
}
