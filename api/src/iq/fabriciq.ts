/**
 * Fabric IQ — recurrence & velocity analytics.
 *
 * Mock: computes how often each pattern recurs across customers and the volume
 * and age of open actions, straight from the synthetic graph.
 *
 * Live wiring (FABRICIQ_LIVE=true): OneLake / Fabric SQL endpoint over a
 * historical fact table of engagements and actions. Not implemented in the MVP.
 */

import { config } from "../config.js";
import {
  indexGraph,
  sharedRisks,
  sharedTopics,
  openActionStats,
} from "../graph/patterns.js";
import type { IngestedGraph, IqSignal } from "../types.js";

export interface FabricIqResult {
  recurrence: { label: string; customers: number }[];
  openActions: number;
  oldestDays: number;
  signal: IqSignal;
}

export function metrics(graph: IngestedGraph): FabricIqResult {
  const idx = indexGraph(graph);
  const clusters = [...sharedRisks(graph, idx), ...sharedTopics(graph, idx)]
    .map((c) => ({ label: c.node.label, customers: c.customers.length }))
    .sort((a, b) => b.customers - a.customers);
  const stats = openActionStats(graph);
  const top = clusters[0];

  const detail = top
    ? `“${top.label}” recurs across ${top.customers} customers; ${stats.count} open actions tracked, oldest ~${stats.oldestDays}d.`
    : `${stats.count} open actions tracked, oldest ~${stats.oldestDays}d.`;

  return {
    recurrence: clusters,
    openActions: stats.count,
    oldestDays: stats.oldestDays,
    signal: {
      iq: "fabric",
      label: "Fabric IQ — recurrence & velocity",
      detail,
      live: config.fabricIq.live,
    },
  };
}
