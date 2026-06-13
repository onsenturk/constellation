/**
 * Deterministic pattern detection over the ingested graph.
 *
 * These helpers are the "multi-hop reasoning" substrate: they find risks and
 * topics shared across customers, and recommendations that recur but were never
 * turned into tracked actions. Both the Foundry IQ reasoner and the ingest
 * summary use them, so the demo and the CLI agree on what the data says.
 */

import type {
  IngestedGraph,
  GraphNode,
  GraphLink,
  Citation,
  ArtifactMeta,
} from "../types";

export interface GraphIndex {
  nodeById: Map<string, GraphNode>;
  neighbors: Map<string, { node: GraphNode; type: GraphLink["type"] }[]>;
  artifactByPath: Map<string, ArtifactMeta>;
}

export function indexGraph(graph: IngestedGraph): GraphIndex {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const neighbors = new Map<string, { node: GraphNode; type: GraphLink["type"] }[]>();
  const push = (from: string, to: string, type: GraphLink["type"]) => {
    const target = nodeById.get(to);
    if (!target) return;
    (neighbors.get(from) ?? neighbors.set(from, []).get(from)!).push({ node: target, type });
  };
  for (const l of graph.links) {
    const s = typeof l.source === "string" ? l.source : (l.source as { id: string }).id;
    const t = typeof l.target === "string" ? l.target : (l.target as { id: string }).id;
    push(s, t, l.type);
    push(t, s, l.type);
  }
  const artifactByPath = new Map(graph.artifacts.map((a) => [a.path, a]));
  return { nodeById, neighbors, artifactByPath };
}

function neighborsOfType(idx: GraphIndex, id: string, type: GraphNode["type"]): GraphNode[] {
  return (idx.neighbors.get(id) ?? [])
    .filter((n) => n.node.type === type)
    .map((n) => n.node);
}

export function customerLabel(idx: GraphIndex, slug: string): string {
  return idx.nodeById.get(`customer:${slug}`)?.label ?? slug;
}

export interface SharedCluster {
  node: GraphNode;
  customers: string[];
  customerLabels: string[];
  artifacts: GraphNode[];
}

function sharedClusters(
  graph: IngestedGraph,
  idx: GraphIndex,
  type: "Risk" | "Topic",
): SharedCluster[] {
  const clusters: SharedCluster[] = [];
  for (const node of graph.nodes) {
    if (node.type !== type) continue;
    const customers = new Set<string>();
    for (const c of neighborsOfType(idx, node.id, "Customer")) {
      if (c.customer) customers.add(c.customer);
    }
    const artifacts = neighborsOfType(idx, node.id, "Artifact");
    for (const a of artifacts) if (a.customer) customers.add(a.customer);
    if (customers.size < 2) continue;
    const list = [...customers].sort();
    clusters.push({
      node,
      customers: list,
      customerLabels: list.map((s) => customerLabel(idx, s)),
      artifacts: artifacts.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    });
  }
  return clusters.sort((a, b) => b.customers.length - a.customers.length || a.node.id.localeCompare(b.node.id));
}

export function sharedRisks(graph: IngestedGraph, idx: GraphIndex): SharedCluster[] {
  return sharedClusters(graph, idx, "Risk");
}

export function sharedTopics(graph: IngestedGraph, idx: GraphIndex): SharedCluster[] {
  return sharedClusters(graph, idx, "Topic");
}

export interface RepeatedRec {
  node: GraphNode;
  customers: string[];
  customerLabels: string[];
  artifacts: GraphNode[];
  tracked: boolean;
}

export function repeatedRecommendations(graph: IngestedGraph, idx: GraphIndex): RepeatedRec[] {
  const out: RepeatedRec[] = [];
  for (const node of graph.nodes) {
    if (node.type !== "Recommendation") continue;
    if ((node.customerCount ?? 0) < 2) continue;
    const customers = neighborsOfType(idx, node.id, "Customer")
      .map((c) => c.customer!)
      .filter(Boolean)
      .sort();
    const artifacts = neighborsOfType(idx, node.id, "Artifact");
    out.push({
      node,
      customers,
      customerLabels: customers.map((s) => customerLabel(idx, s)),
      artifacts,
      tracked: node.tracked !== false,
    });
  }
  return out.sort((a, b) => b.customers.length - a.customers.length || a.node.label.localeCompare(b.node.label));
}

export function untrackedRepeatedRecs(graph: IngestedGraph, idx: GraphIndex): RepeatedRec[] {
  return repeatedRecommendations(graph, idx).filter((r) => !r.tracked);
}

export function timeline(graph: IngestedGraph): ArtifactMeta[] {
  return [...graph.artifacts].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

export function citationFor(idx: GraphIndex, path: string, fallbackTitle = ""): Citation {
  const a = idx.artifactByPath.get(path);
  return {
    artifactPath: path,
    title: a?.title ?? fallbackTitle ?? path,
    date: a?.date ?? "",
    excerpt: a?.excerpt ?? "",
  };
}

export function openActionStats(graph: IngestedGraph): {
  count: number;
  oldestDays: number;
  byCustomer: Record<string, number>;
} {
  const today = new Date("2026-06-13T00:00:00Z").getTime();
  const actions = graph.nodes.filter((n) => n.type === "Action");
  let oldestDays = 0;
  const byCustomer: Record<string, number> = {};
  for (const a of actions) {
    if (a.customer) byCustomer[a.customer] = (byCustomer[a.customer] ?? 0) + 1;
    if (a.date) {
      const days = Math.round((today - new Date(a.date + "T00:00:00Z").getTime()) / 86_400_000);
      if (Math.abs(days) > Math.abs(oldestDays)) oldestDays = days;
    }
  }
  return { count: actions.length, oldestDays: Math.abs(oldestDays), byCustomer };
}
