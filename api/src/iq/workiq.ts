/**
 * Work IQ — meeting / recency / owner enrichment.
 *
 * Mock: resolves action owners from the customer contact captured at ingest,
 * assigns dated due dates, and reports which recommendations were "discussed
 * but not assigned" in the most recent meeting.
 *
 * Live wiring (WORKIQ_LIVE=true): Microsoft Graph (calendar, attendees, recent
 * messages) keyed on customer + topic. Not implemented in the MVP.
 */

import { config } from "../config.js";
import type { IngestedGraph, ActionCard, IqSignal, ArtifactMeta } from "../types.js";
import type { CandidateAction } from "./foundry.js";

const SPECIALIST = "Alex Rivera";
const BASE_DUE = new Date("2026-06-16T00:00:00Z").getTime();

function addDays(base: number, days: number): string {
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

export interface WorkIqResult {
  actions: ActionCard[];
  signal: IqSignal;
}

export function enrich(
  candidates: CandidateAction[],
  graph: IngestedGraph,
  opts: { untrackedCount: number },
): WorkIqResult {
  const contactByCustomer = new Map<string, string>();
  for (const n of graph.nodes) {
    if (n.type === "Customer" && n.owner) contactByCustomer.set(n.customer ?? n.id, n.owner);
  }

  const meeting: ArtifactMeta | undefined = [...graph.artifacts]
    .filter((a) => a.type === "meeting")
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const actions: ActionCard[] = candidates.map((c, i) => {
    const owner = c.owner || (c.customer ? contactByCustomer.get(c.customer) : undefined) || SPECIALIST;
    return {
      id: `action-${i + 1}`,
      title: c.title,
      owner,
      dueDate: addDays(BASE_DUE, 3 + i * 2),
      confidence: c.confidence,
      sourcePath: c.sourcePath,
      rationale: c.rationale,
    };
  });

  const detailParts = [`Resolved owners for ${actions.length} proposed actions`];
  if (meeting && opts.untrackedCount > 0) {
    detailParts.push(
      `${opts.untrackedCount} recommendation${opts.untrackedCount === 1 ? "" : "s"} discussed at the ${meeting.date} sync but left unassigned`,
    );
  }

  return {
    actions,
    signal: {
      iq: "work",
      label: "Work IQ — recency & owners",
      detail: detailParts.join("; ") + ".",
      live: config.workIq.live,
    },
  };
}
