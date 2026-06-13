import { Router } from "express";

import { rebuildGraph } from "../data/load.js";
import {
  indexGraph,
  sharedRisks,
  sharedTopics,
  untrackedRepeatedRecs,
  openActionStats,
} from "../graph/patterns.js";

export const ingestRouter = Router();

/** Rebuild the in-memory graph from the source artifacts and report a summary. */
ingestRouter.post("/", (_req, res) => {
  const graph = rebuildGraph();
  const idx = indexGraph(graph);
  res.json({
    nodes: graph.nodes.length,
    links: graph.links.length,
    artifacts: graph.artifacts.length,
    sharedRisks: sharedRisks(graph, idx).map((r) => ({
      label: r.node.label,
      customers: r.customerLabels,
    })),
    sharedTopics: sharedTopics(graph, idx).map((t) => ({
      label: t.node.label,
      customers: t.customerLabels,
    })),
    untrackedRepeated: untrackedRepeatedRecs(graph, idx).map((u) => ({
      label: u.node.label,
      customers: u.customerLabels,
    })),
    openActions: openActionStats(graph),
  });
});
