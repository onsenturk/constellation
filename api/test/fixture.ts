/**
 * Hermetic graph fixture for unit tests.
 *
 * A tiny, hand-built IngestedGraph that exercises the cross-customer pattern
 * engine without depending on the committed data/graph.json:
 *   - risk:r1   shared by alpha + beta
 *   - topic:t1  shared by beta + gamma
 *   - rec:shared repeated across alpha + beta, untracked
 *   - rec:solo   single-customer, tracked (must be ignored as a "pattern")
 */

import type { IngestedGraph } from "../src/types.js";

export function makeGraph(): IngestedGraph {
  const graph = {
    nodes: [
      { id: "customer:alpha", type: "Customer", label: "Alpha Corp", customer: "alpha", tags: [], owner: "Dana Alpha" },
      { id: "customer:beta", type: "Customer", label: "Beta LLC", customer: "beta", tags: [], owner: "Erin Beta" },
      { id: "customer:gamma", type: "Customer", label: "Gamma Inc", customer: "gamma", tags: [] },
      { id: "risk:r1", type: "Risk", label: "restore exceeds RTO", tags: [] },
      { id: "topic:t1", type: "Topic", label: "postgres migration", tags: [] },
      {
        id: "rec:shared",
        type: "Recommendation",
        label: "attach before hydration",
        tags: [],
        tracked: false,
        customerCount: 2,
        confidence: "Likely",
        owner: "Dana Alpha",
      },
      { id: "rec:solo", type: "Recommendation", label: "tune one knob", tags: [], tracked: true, customerCount: 1, confidence: "Verified" },
      { id: "artifact:a1", type: "Artifact", label: "Alpha report", customer: "alpha", date: "2026-05-20", artifactPath: "sample-data/customers/alpha/a1.md", tags: [] },
      { id: "artifact:a2", type: "Artifact", label: "Beta report", customer: "beta", date: "2026-05-22", artifactPath: "sample-data/customers/beta/a2.md", tags: [] },
      { id: "artifact:a3", type: "Artifact", label: "Gamma report", customer: "gamma", date: "2026-05-18", artifactPath: "sample-data/customers/gamma/a3.md", tags: [] },
      { id: "person:p1", type: "Person", label: "Dana Alpha", tags: [] },
      { id: "action:act1", type: "Action", label: "do the thing", customer: "alpha", date: "2026-05-25", tags: [] },
    ],
    links: [
      { source: "customer:alpha", target: "risk:r1", type: "shares-risk" },
      { source: "customer:beta", target: "risk:r1", type: "shares-risk" },
      { source: "customer:beta", target: "topic:t1", type: "shares-topic" },
      { source: "customer:gamma", target: "topic:t1", type: "shares-topic" },
      { source: "risk:r1", target: "rec:shared", type: "addresses" },
      { source: "rec:shared", target: "customer:alpha", type: "recommends" },
      { source: "rec:shared", target: "customer:beta", type: "recommends" },
      { source: "rec:shared", target: "artifact:a1", type: "derived-from" },
      { source: "rec:shared", target: "artifact:a2", type: "derived-from" },
      { source: "artifact:a1", target: "risk:r1", type: "mentions" },
      { source: "artifact:a2", target: "risk:r1", type: "mentions" },
    ],
    artifacts: [
      { path: "sample-data/customers/alpha/a1.md", title: "Alpha report", customer: "alpha", date: "2026-05-20", type: "report", tags: [], excerpt: "alpha restore excerpt" },
      { path: "sample-data/customers/beta/a2.md", title: "Beta report", customer: "beta", date: "2026-05-22", type: "report", tags: [], excerpt: "beta restore excerpt" },
      { path: "sample-data/customers/gamma/a3.md", title: "Gamma report", customer: "gamma", date: "2026-05-18", type: "report", tags: [], excerpt: "gamma migration excerpt" },
    ],
  };
  return graph as unknown as IngestedGraph;
}
