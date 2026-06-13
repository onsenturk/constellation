/**
 * Canonical Constellation API contract.
 *
 * This file is the single source of truth for the shapes exchanged between the
 * API and the web client. `web/src/types.ts` mirrors the public response types.
 */

/** Confidence label shown on every grounded claim and action. */
export type Confidence = "Verified" | "Likely" | "Uncertain";

/** Creative "scene modes" that reframe the same graph + data. */
export type SceneMode = "pattern-hunt" | "executive-story" | "playbook-remix";

/** Node categories in the knowledge constellation. */
export type NodeType =
  | "Customer"
  | "Topic"
  | "Risk"
  | "Recommendation"
  | "Action"
  | "Artifact"
  | "Person";

/** Relationship categories between nodes. */
export type EdgeType =
  | "mentions"
  | "shares-topic"
  | "shares-risk"
  | "derived-from"
  | "owns"
  | "follows-up"
  | "supersedes"
  | "recommends"
  | "addresses";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  /** Owning customer slug, when the node belongs to one customer. */
  customer?: string;
  tags: string[];
  /** ISO date (YYYY-MM-DD) for artifacts and actions. */
  date?: string;
  /** Relative path into the data set, for source-grounding. */
  artifactPath?: string;
  /** Visual grouping hint set by the composer (e.g. "focus" | "context"). */
  group?: string;
  /** Recommendation/Action only: mapped confidence label. */
  confidence?: Confidence;
  /** Recommendation only: is this rec already a tracked action? */
  tracked?: boolean;
  /** Recommendation/Action only: number of distinct customers it spans. */
  customerCount?: number;
  /** Person/Action/Recommendation: responsible owner display name. */
  owner?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: EdgeType;
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/** Metadata for one ingested source artifact. */
export interface ArtifactMeta {
  path: string;
  title: string;
  customer: string;
  date: string;
  /** report | tasks | meeting | prep | readme */
  type: string;
  tags: string[];
  excerpt: string;
}

/** Full ingest output written to data/graph.json. */
export interface IngestedGraph extends GraphData {
  artifacts: ArtifactMeta[];
}

export interface Citation {
  artifactPath: string;
  title: string;
  date: string;
  excerpt: string;
}

export interface NarrativeSegment {
  text: string;
  confidence: Confidence;
  citations: Citation[];
}

export interface Narrative {
  title: string;
  summary: string;
  segments: NarrativeSegment[];
}

export interface ActionCard {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  confidence: Confidence;
  sourcePath: string;
  rationale: string;
}

/** A visible, honest signal that one IQ layer contributed to the result. */
export interface IqSignal {
  iq: "foundry" | "work" | "fabric";
  label: string;
  detail: string;
  /** true = real API call, false = deterministic mock / sample data. */
  live: boolean;
}

export interface QueryRequest {
  prompt: string;
  mode: SceneMode;
  safeDemo: boolean;
}

export interface QueryResponse {
  graph: GraphData;
  narrative: Narrative;
  actions: ActionCard[];
  signals: IqSignal[];
  highlightedNodeIds: string[];
}
