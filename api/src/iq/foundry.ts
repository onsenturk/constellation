/**
 * Foundry IQ — grounded multi-hop reasoning (CORE).
 *
 * Phase-1 MVP uses a deterministic mock that reasons over the ingested graph:
 * it finds risks/topics shared across customers and recommendations that recur
 * but were never tracked, then composes a cited, source-grounded narrative for
 * the selected scene mode.
 *
 * Live wiring: set FOUNDRY_LIVE=true with a real Azure AI Foundry project
 * (DefaultAzureCredential). Until that path is implemented it fails closed.
 */

import { config } from "../config.js";
import { narrate } from "./foundryClient.js";
import {
  indexGraph,
  sharedRisks,
  sharedTopics,
  repeatedRecommendations,
  timeline,
  citationFor,
  customerLabel,
  type GraphIndex,
  type SharedCluster,
  type RepeatedRec,
} from "../graph/patterns.js";
import type {
  IngestedGraph,
  GraphNode,
  Narrative,
  NarrativeSegment,
  Citation,
  SceneMode,
  Confidence,
} from "../types.js";

export interface CandidateAction {
  title: string;
  rationale: string;
  sourcePath: string;
  confidence: Confidence;
  owner?: string;
  customer?: string;
}

export interface ReasonResult {
  narrative: Narrative;
  citations: Citation[];
  highlightedNodeIds: string[];
  candidateActions: CandidateAction[];
  /** true when a live Azure AI Foundry call produced this narrative. */
  live: boolean;
  /** Honest signal detail describing how the narrative was produced. */
  detail: string;
}

/** The deterministic result before optional live re-narration. */
type Draft = Omit<ReasonResult, "live" | "detail">;

type Focus = "restore-risk" | "migration" | "cost" | "untracked" | "";

function pickFocus(prompt: string): Focus {
  const p = prompt.toLowerCase();
  if (/repeat|untrack|track|follow[- ]?up|slip|convert|not yet|outstanding/.test(p)) return "untracked";
  if (/migrat|postgres|oracle/.test(p)) return "migration";
  if (/cost|spend|rightsiz|budget|reservation|savings/.test(p)) return "cost";
  if (/backup|restore|\bdr\b|hydrat|\brto\b|risk|recover|failover/.test(p)) return "restore-risk";
  return "";
}

export async function reason(
  prompt: string,
  mode: SceneMode,
  graph: IngestedGraph,
): Promise<ReasonResult> {
  if (config.foundry.live && (!config.foundry.endpoint || !config.foundry.deployment)) {
    // Fail closed: never silently fall back to mock when "live" was requested.
    throw new Error(
      "Foundry live not configured: set AZURE_AI_FOUNDRY_ENDPOINT and AZURE_AI_FOUNDRY_DEPLOYMENT (or FOUNDRY_LIVE=false).",
    );
  }

  const idx = indexGraph(graph);
  const repeated = repeatedRecommendations(graph, idx);
  const ctx: Ctx = {
    graph,
    idx,
    risks: sharedRisks(graph, idx),
    topics: sharedTopics(graph, idx),
    repeated,
    untracked: repeated.filter((r) => !r.tracked),
    focus: pickFocus(prompt),
  };

  const draft = buildDraft(ctx, mode);

  if (!config.foundry.live) {
    return { ...draft, live: false, detail: mockDetail(graph, draft) };
  }

  // Live: the model only re-narrates the grounded draft; citations are unchanged.
  try {
    const narrative = await narrateDraft(draft, prompt);
    return { ...draft, narrative, live: true, detail: liveDetail(graph, draft) };
  } catch (err) {
    // Honest, *visible* fallback: flip the badge to Mock and say why, rather
    // than silently pretending the live call happened.
    const why = err instanceof Error ? err.message : "unknown error";
    return {
      ...draft,
      live: false,
      detail: `Live Foundry call failed (${why}); served the deterministic narrative.`,
    };
  }
}

function buildDraft(ctx: Ctx, mode: SceneMode): Draft {
  switch (mode) {
    case "executive-story":
      return buildExecutiveStory(ctx);
    case "playbook-remix":
      return buildPlaybookRemix(ctx);
    case "pattern-hunt":
    default:
      return buildPatternHunt(ctx);
  }
}

function mockDetail(graph: IngestedGraph, draft: Draft): string {
  return `Reasoned over ${graph.nodes.length} nodes and ${graph.links.length} links; composed a grounded narrative with ${draft.citations.length} citations (deterministic mock).`;
}

function liveDetail(graph: IngestedGraph, draft: Draft): string {
  return `Azure AI Foundry (${config.foundry.deployment}) re-narrated ${draft.narrative.segments.length} grounded findings over ${graph.nodes.length} nodes; ${draft.citations.length} citations preserved.`;
}

/**
 * Ask the live model to rewrite the draft's prose, then map the rewritten text
 * back onto the deterministic segments so every confidence label and citation
 * is preserved exactly. Throws if the model breaks the segment-count contract.
 */
async function narrateDraft(draft: Draft, prompt: string): Promise<Narrative> {
  const segs = draft.narrative.segments;
  if (segs.length === 0) return draft.narrative;

  const facts = segs.map((s, i) => `(${i + 1}) [${s.confidence}] ${s.text}`);
  const sources = draft.citations
    .slice(0, 8)
    .map((c) => `${c.title}: ${c.excerpt}`)
    .filter(Boolean);

  const out = await narrate({
    question: prompt,
    title: draft.narrative.title,
    summary: draft.narrative.summary,
    facts,
    sources,
    segmentCount: segs.length,
  });

  if (out.segmentTexts.length !== segs.length) {
    throw new Error(`model returned ${out.segmentTexts.length} segments, expected ${segs.length}`);
  }

  return {
    title: out.title || draft.narrative.title,
    summary: out.summary || draft.narrative.summary,
    segments: segs.map((s, i) => ({ ...s, text: out.segmentTexts[i] })),
  };
}

// --- Shared context + helpers ----------------------------------------------

interface Ctx {
  graph: IngestedGraph;
  idx: GraphIndex;
  risks: SharedCluster[];
  topics: SharedCluster[];
  repeated: RepeatedRec[];
  untracked: RepeatedRec[];
  focus: Focus;
}

const neigh = (idx: GraphIndex, id: string, type: GraphNode["type"]): GraphNode[] =>
  (idx.neighbors.get(id) ?? []).filter((n) => n.node.type === type).map((n) => n.node);

function clusterCitations(ctx: Ctx, cluster: SharedCluster): Citation[] {
  const out: Citation[] = [];
  for (const slug of cluster.customers) {
    const art = cluster.artifacts.find((a) => a.customer === slug);
    if (art?.artifactPath) out.push(citationFor(ctx.idx, art.artifactPath, art.label));
  }
  return out;
}

function clusterHighlights(cluster: SharedCluster): string[] {
  return [
    cluster.node.id,
    ...cluster.customers.map((s) => `customer:${s}`),
    ...cluster.artifacts.map((a) => a.id),
  ];
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function seg(text: string, confidence: Confidence, citations: Citation[] = []): NarrativeSegment {
  return { text, confidence, citations };
}

/** Recommendations (untracked first) that address a given risk node. */
function recsAddressing(ctx: Ctx, riskId: string): GraphNode[] {
  return neigh(ctx.idx, riskId, "Recommendation").sort(
    (a, b) => Number(a.tracked ?? true) - Number(b.tracked ?? true),
  );
}

function leadRiskOrTopic(ctx: Ctx): SharedCluster | undefined {
  if (ctx.focus === "migration") {
    return ctx.topics.find((t) => t.node.id === "topic:postgresql-migration") ?? ctx.risks[0] ?? ctx.topics[0];
  }
  if (ctx.focus === "cost") {
    return ctx.topics.find((t) => t.node.id === "topic:cost-optimization") ?? ctx.risks[0] ?? ctx.topics[0];
  }
  return ctx.risks[0] ?? ctx.topics[0];
}

function candidatesFromRisk(ctx: Ctx, cluster: SharedCluster): CandidateAction[] {
  const out: CandidateAction[] = [];
  for (const rec of recsAddressing(ctx, cluster.node.id)) {
    if (rec.tracked !== false) continue;
    const art = neigh(ctx.idx, rec.id, "Artifact")[0];
    out.push({
      title: `Make “${rec.label}” a tracked runbook step`,
      rationale: `Recurs across ${joinLabels(
        neigh(ctx.idx, rec.id, "Customer").map((c) => c.label),
      )} but is not in the tracked action list.`,
      sourcePath: art?.artifactPath ?? cluster.artifacts[0]?.artifactPath ?? "",
      confidence: rec.confidence ?? "Likely",
      owner: rec.owner,
    });
  }
  out.push({
    title: `Publish a portfolio “${cluster.node.label}” playbook`,
    rationale: `${cluster.customers.length} customers share this pattern — one playbook resolves it once instead of ${cluster.customers.length} times.`,
    sourcePath: cluster.artifacts[0]?.artifactPath ?? "",
    confidence: "Likely",
  });
  return out;
}

// --- Scene mode: Pattern Hunt ----------------------------------------------

function buildPatternHunt(ctx: Ctx): Draft {
  if (ctx.focus === "untracked" && ctx.untracked.length) {
    return buildUntrackedHunt(ctx);
  }
  const lead = leadRiskOrTopic(ctx);
  if (!lead) return emptyResult("Pattern Hunt");

  const cites = clusterCitations(ctx, lead);
  const segments: NarrativeSegment[] = [];
  segments.push(
    seg(
      `Hidden cluster: “${lead.node.label}” now connects ${joinLabels(lead.customerLabels)} — ${lead.customers.length} customers reached through the same node.`,
      "Verified",
      cites,
    ),
  );
  for (const slug of lead.customers) {
    const art = lead.artifacts.find((a) => a.customer === slug);
    if (!art?.artifactPath) continue;
    const c = citationFor(ctx.idx, art.artifactPath, art.label);
    segments.push(seg(`${customerLabel(ctx.idx, slug)}: ${c.excerpt}`, "Verified", [c]));
  }
  segments.push(
    seg(
      `Because the same pattern recurs, it is a portfolio signal rather than ${lead.customers.length} isolated tickets — solve it once and reuse the fix.`,
      "Likely",
      cites,
    ),
  );

  const untrackedForLead = recsAddressing(ctx, lead.node.id).filter((r) => r.tracked === false);
  if (untrackedForLead.length) {
    segments.push(
      seg(
        `Two proven recommendations addressing this — ${joinLabels(
          untrackedForLead.map((r) => `“${r.label}”`),
        )} — are not yet tracked anywhere.`,
        "Uncertain",
        cites,
      ),
    );
  }

  const highlights = new Set<string>(clusterHighlights(lead));
  untrackedForLead.forEach((r) => highlights.add(r.id));

  return {
    narrative: {
      title: `Pattern Hunt — ${lead.node.label}`,
      summary: `One node links ${lead.customers.length} customers: ${joinLabels(lead.customerLabels)}.`,
      segments,
    },
    citations: cites,
    highlightedNodeIds: [...highlights],
    candidateActions: candidatesFromRisk(ctx, lead),
  };
}

function buildUntrackedHunt(ctx: Ctx): Draft {
  const segments: NarrativeSegment[] = [];
  const cites: Citation[] = [];
  const highlights = new Set<string>();
  segments.push(
    seg(
      `${ctx.untracked.length} recommendations recur across customers but were never converted into tracked actions — quiet follow-up risk.`,
      "Verified",
    ),
  );
  for (const rec of ctx.untracked) {
    const arts = neigh(ctx.idx, rec.node.id, "Artifact");
    const recCites = arts
      .map((a) => (a.artifactPath ? citationFor(ctx.idx, a.artifactPath, a.label) : null))
      .filter((c): c is Citation => c !== null);
    cites.push(...recCites);
    segments.push(
      seg(
        `“${rec.node.label}” appears for ${joinLabels(rec.customerLabels)}, yet no open task tracks it.`,
        "Verified",
        recCites,
      ),
    );
    highlights.add(rec.node.id);
    rec.customers.forEach((s) => highlights.add(`customer:${s}`));
    arts.forEach((a) => highlights.add(a.id));
  }
  segments.push(
    seg(
      `Converting these into owned, dated actions closes the gap between insight and follow-through.`,
      "Likely",
    ),
  );

  const candidateActions: CandidateAction[] = ctx.untracked.map((rec) => {
    const art = neigh(ctx.idx, rec.node.id, "Artifact")[0];
    return {
      title: `Track: ${rec.node.label}`,
      rationale: `Repeated for ${joinLabels(rec.customerLabels)} but absent from the open-tasks list.`,
      sourcePath: art?.artifactPath ?? "",
      confidence: rec.node.confidence ?? "Likely",
      owner: rec.node.owner,
    };
  });

  return {
    narrative: {
      title: "Pattern Hunt — repeated, untracked recommendations",
      summary: `${ctx.untracked.length} recurring recommendations have no tracked action.`,
      segments,
    },
    citations: cites,
    highlightedNodeIds: [...highlights],
    candidateActions,
  };
}

// --- Scene mode: Executive Story -------------------------------------------

function buildExecutiveStory(ctx: Ctx): Draft {
  const tl = timeline(ctx.graph);
  const customers = ctx.graph.nodes.filter((n) => n.type === "Customer");
  const topRisk = ctx.risks[0];
  const migration = ctx.topics.find((t) => t.node.id === "topic:postgresql-migration");
  const cost = ctx.topics.find((t) => t.node.id === "topic:cost-optimization");
  const segments: NarrativeSegment[] = [];
  const allCites: Citation[] = [];
  const highlights = new Set<string>();
  customers.forEach((c) => highlights.add(c.id));

  // Beat 1 — scope
  const recent = tl.slice(-3).map((a) => citationFor(ctx.idx, a.path, a.title));
  allCites.push(...recent);
  segments.push(
    seg(
      `Across ${customers.length} customers and ${ctx.graph.artifacts.length} artifacts, three cross-cutting themes shaped the period: resilience, modernization, and cost.`,
      "Verified",
      recent,
    ),
  );

  // Beat 2 — dominant risk
  if (topRisk) {
    const c = clusterCitations(ctx, topRisk);
    allCites.push(...c);
    clusterHighlights(topRisk).forEach((h) => highlights.add(h));
    segments.push(
      seg(
        `Resilience is the headline: “${topRisk.node.label}” is shared by ${joinLabels(topRisk.customerLabels)} — the single most connected risk in the portfolio.`,
        "Verified",
        c,
      ),
    );
  }
  // Beat 3 — modernization
  if (migration) {
    const c = clusterCitations(ctx, migration);
    allCites.push(...c);
    clusterHighlights(migration).forEach((h) => highlights.add(h));
    segments.push(
      seg(
        `Modernization is accelerating: ${joinLabels(migration.customerLabels)} are both moving Oracle to Azure Database for PostgreSQL, so one migration playbook serves both.`,
        "Likely",
        c,
      ),
    );
  }
  // Beat 4 — cost
  if (cost) {
    const c = clusterCitations(ctx, cost);
    allCites.push(...c);
    clusterHighlights(cost).forEach((h) => highlights.add(h));
    segments.push(
      seg(
        `Cost discipline is recurring: ${joinLabels(cost.customerLabels)} surfaced rightsizing and reservation opportunities in the same window.`,
        "Likely",
        c,
      ),
    );
  }
  // Beat 5 — the gap
  if (ctx.untracked.length) {
    const gapCites = ctx.untracked
      .flatMap((r) => neigh(ctx.idx, r.node.id, "Artifact"))
      .map((a) => (a.artifactPath ? citationFor(ctx.idx, a.artifactPath, a.label) : null))
      .filter((c): c is Citation => c !== null)
      .slice(0, 2);
    allCites.push(...gapCites);
    ctx.untracked.forEach((r) => highlights.add(r.node.id));
    segments.push(
      seg(
        `The watch-out: ${ctx.untracked.length} proven recommendations recur but are untracked — the gap between knowing and doing.`,
        "Uncertain",
        gapCites,
      ),
    );
  }

  const candidateActions: CandidateAction[] = [];
  if (topRisk) {
    candidateActions.push({
      title: `Stand up a portfolio “${topRisk.node.label}” playbook`,
      rationale: `Resolve a risk shared by ${topRisk.customers.length} customers once, centrally.`,
      sourcePath: topRisk.artifacts[0]?.artifactPath ?? "",
      confidence: "Likely",
    });
  }
  for (const rec of ctx.untracked) {
    candidateActions.push({
      title: `Assign an owner to “${rec.node.label}”`,
      rationale: `Recurs for ${joinLabels(rec.customerLabels)} yet has no tracked action.`,
      sourcePath: neigh(ctx.idx, rec.node.id, "Artifact")[0]?.artifactPath ?? "",
      confidence: rec.node.confidence ?? "Likely",
      owner: rec.node.owner,
    });
  }

  return {
    narrative: {
      title: "Executive Story — this period across the portfolio",
      summary: "A board-ready read: resilience, modernization, cost — and the follow-through gap.",
      segments,
    },
    citations: allCites,
    highlightedNodeIds: [...highlights],
    candidateActions,
  };
}

// --- Scene mode: Playbook Remix --------------------------------------------

function buildPlaybookRemix(ctx: Ctx): Draft {
  // Find a proven, repeated recommendation that addresses a shared risk, where
  // at least one customer in that risk cluster has not adopted it yet.
  let chosen: { rec: RepeatedRec; risk: SharedCluster; target: string } | undefined;
  for (const risk of ctx.risks) {
    for (const rec of ctx.repeated) {
      const adopters = new Set(rec.customers);
      const gap = risk.customers.find((s) => !adopters.has(s));
      const addresses = neigh(ctx.idx, risk.node.id, "Recommendation").some((r) => r.id === rec.node.id);
      if (addresses && gap) {
        chosen = { rec, risk, target: gap };
        break;
      }
    }
    if (chosen) break;
  }

  if (!chosen) {
    // Fall back to pattern hunt framing if no remix opportunity exists.
    return buildPatternHunt(ctx);
  }

  const { rec, risk, target } = chosen;
  const adopterLabels = rec.customerLabels;
  const targetLabel = customerLabel(ctx.idx, target);
  const proofCites = rec.artifacts
    .map((a) => (a.artifactPath ? citationFor(ctx.idx, a.artifactPath, a.label) : null))
    .filter((c): c is Citation => c !== null);
  const targetArt = risk.artifacts.find((a) => a.customer === target);
  const targetCite = targetArt?.artifactPath
    ? citationFor(ctx.idx, targetArt.artifactPath, targetArt.label)
    : undefined;

  const segments: NarrativeSegment[] = [
    seg(
      `A proven pattern already exists: “${rec.node.label}” resolved “${risk.node.label}” at ${joinLabels(adopterLabels)}.`,
      "Verified",
      proofCites,
    ),
    seg(
      `${targetLabel} shows the same “${risk.node.label}” — but has not adopted the fix.`,
      "Verified",
      targetCite ? [targetCite] : [],
    ),
    seg(
      `Remix: lift the ${adopterLabels[0]} playbook and apply “${rec.node.label}” to ${targetLabel} — a tested solution, not a fresh investigation.`,
      "Likely",
      proofCites.slice(0, 1),
    ),
  ];

  const highlights = new Set<string>([
    rec.node.id,
    risk.node.id,
    `customer:${target}`,
    ...rec.customers.map((s) => `customer:${s}`),
    ...rec.artifacts.map((a) => a.id),
  ]);
  if (targetArt) highlights.add(targetArt.id);

  const candidateActions: CandidateAction[] = [
    {
      title: `Apply “${rec.node.label}” to ${targetLabel}`,
      rationale: `Proven at ${joinLabels(adopterLabels)}; ${targetLabel} has the same open risk.`,
      sourcePath: targetArt?.artifactPath ?? rec.artifacts[0]?.artifactPath ?? "",
      confidence: "Likely",
      customer: target,
    },
    {
      title: `Package the “${rec.node.label}” playbook for reuse`,
      rationale: `Turn a one-off fix into a portfolio-standard runbook step.`,
      sourcePath: rec.artifacts[0]?.artifactPath ?? "",
      confidence: rec.node.confidence ?? "Likely",
      owner: rec.node.owner,
    },
  ];

  return {
    narrative: {
      title: `Playbook Remix — ${rec.node.label}`,
      summary: `Reuse a fix proven at ${joinLabels(adopterLabels)} for ${targetLabel}.`,
      segments,
    },
    citations: [...proofCites, ...(targetCite ? [targetCite] : [])],
    highlightedNodeIds: [...highlights],
    candidateActions,
  };
}

function emptyResult(title: string): Draft {
  return {
    narrative: {
      title,
      summary: "No cross-customer patterns were detected in the current data set.",
      segments: [seg("Ingest the sample data to populate the constellation.", "Uncertain")],
    },
    citations: [],
    highlightedNodeIds: [],
    candidateActions: [],
  };
}
