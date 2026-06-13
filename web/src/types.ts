/**
 * Web mirror of the Constellation API contract.
 * Keep in sync with api/src/types.ts (public response types).
 */

export type Confidence = "Verified" | "Likely" | "Uncertain";
export type SceneMode = "pattern-hunt" | "executive-story" | "playbook-remix";

export type NodeType =
  | "Customer"
  | "Topic"
  | "Risk"
  | "Recommendation"
  | "Action"
  | "Artifact"
  | "Person";

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
  customer?: string;
  tags: string[];
  date?: string;
  artifactPath?: string;
  group?: string;
  confidence?: Confidence;
  tracked?: boolean;
  customerCount?: number;
  owner?: string;
  // Mutated at runtime by the force simulation:
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: EdgeType;
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
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

export interface IqSignal {
  iq: "foundry" | "work" | "fabric";
  label: string;
  detail: string;
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
