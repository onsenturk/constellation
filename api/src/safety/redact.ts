/**
 * Safe-demo redaction.
 *
 * When safeDemo is on, person names are masked to initials and emails are
 * removed across the narrative, actions, and graph labels. External publishing
 * is blocked by default at the route layer (see server.ts /api/export).
 */

import type { IngestedGraph, QueryResponse, GraphNode } from "../types.js";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name;
  return parts.map((p) => p[0].toUpperCase()).join(".") + ".";
}

/** Build a name -> initials map from the graph's Person nodes (longest first). */
function nameMap(graph: IngestedGraph): { re: RegExp; mask: string }[] {
  const names = graph.nodes
    .filter((n) => n.type === "Person")
    .map((n) => n.label)
    .filter((l) => /\s/.test(l)) // only multi-word names, to avoid masking common words
    .sort((a, b) => b.length - a.length);
  return names.map((name) => ({
    re: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
    mask: initials(name),
  }));
}

function maskText(text: string, map: { re: RegExp; mask: string }[]): string {
  let out = text.replace(EMAIL_RE, "[redacted]");
  for (const { re, mask } of map) out = out.replace(re, mask);
  return out;
}

export function redactResponse(response: QueryResponse, graph: IngestedGraph): QueryResponse {
  const map = nameMap(graph);
  const mask = (t: string) => maskText(t, map);

  return {
    ...response,
    narrative: {
      ...response.narrative,
      summary: mask(response.narrative.summary),
      segments: response.narrative.segments.map((s) => ({
        ...s,
        text: mask(s.text),
        citations: s.citations.map((c) => ({ ...c, excerpt: mask(c.excerpt) })),
      })),
    },
    actions: response.actions.map((a) => ({
      ...a,
      owner: mask(a.owner),
      title: mask(a.title),
      rationale: mask(a.rationale),
    })),
    graph: {
      ...response.graph,
      nodes: response.graph.nodes.map((n: GraphNode) =>
        n.type === "Person" ? { ...n, label: initials(n.label), owner: undefined } : n,
      ),
    },
  };
}
