/** Loads the knowledge graph: prefers committed data/graph.json, falls back to a live build. */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { config } from "../config.js";
import { buildGraph } from "../graph/build.js";
import type { IngestedGraph } from "../types.js";

const rooted = (p: string): string => (isAbsolute(p) ? p : resolve(config.repoRoot, p));

let cache: IngestedGraph | null = null;

/** Build the graph fresh from the source artifacts (no cache). */
export function rebuildGraph(): IngestedGraph {
  cache = buildGraph(rooted(config.dataDir));
  return cache;
}

/** Get the cached graph, loading it once from disk or building it on demand. */
export function getGraph(): IngestedGraph {
  if (cache) return cache;
  const graphFile = rooted(config.graphPath);
  if (existsSync(graphFile)) {
    try {
      cache = JSON.parse(readFileSync(graphFile, "utf8")) as IngestedGraph;
      return cache;
    } catch {
      // Corrupt or partial file — rebuild from source.
    }
  }
  return rebuildGraph();
}
