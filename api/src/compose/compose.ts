/**
 * Composer — orchestrates the three IQ layers into one grounded response.
 *
 *   Foundry IQ  → grounded multi-hop narrative + citations + candidate actions
 *   Work IQ     → owners + due dates + recency signal
 *   Fabric IQ   → recurrence + velocity metrics
 *
 * Then applies safe-demo redaction when requested.
 */

import { getGraph } from "../data/load.js";
import { reason } from "../iq/foundry.js";
import { enrich } from "../iq/workiq.js";
import { metrics } from "../iq/fabriciq.js";
import { indexGraph, untrackedRepeatedRecs } from "../graph/patterns.js";
import { redactResponse } from "../safety/redact.js";
import type { GraphData, IqSignal, QueryRequest, QueryResponse } from "../types.js";

export async function composeQuery(req: QueryRequest): Promise<QueryResponse> {
  const graph = getGraph();
  const idx = indexGraph(graph);

  // Foundry IQ (core reasoning).
  const reasoned = await reason(req.prompt, req.mode, graph);

  // Work IQ + Fabric IQ enrichment.
  const untrackedCount = untrackedRepeatedRecs(graph, idx).length;
  const work = enrich(reasoned.candidateActions, graph, { untrackedCount });
  const fabric = metrics(graph);

  const foundrySignal: IqSignal = {
    iq: "foundry",
    label: "Foundry IQ — multi-hop reasoning",
    detail: reasoned.detail,
    live: reasoned.live,
  };

  // Emphasize highlighted nodes; keep the rest as context.
  const highlight = new Set(reasoned.highlightedNodeIds);
  const displayGraph: GraphData = {
    nodes: graph.nodes.map((n) => ({ ...n, group: highlight.has(n.id) ? "focus" : "context" })),
    links: graph.links.map((l) => ({ ...l })),
  };

  let response: QueryResponse = {
    graph: displayGraph,
    narrative: reasoned.narrative,
    actions: work.actions,
    signals: [foundrySignal, work.signal, fabric.signal],
    highlightedNodeIds: reasoned.highlightedNodeIds,
  };

  if (req.safeDemo) response = redactResponse(response, graph);
  return response;
}
