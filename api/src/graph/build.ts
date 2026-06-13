/**
 * Constellation ingest parser.
 *
 * Reads the synthetic Markdown artifacts under a data directory and builds a
 * deterministic knowledge graph: customers, artifacts, topics, risks,
 * recommendations, actions and people, plus the cross-customer edges that make
 * hidden patterns visible.
 *
 * Pure + deterministic: same input always yields the same graph.json.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import type {
  IngestedGraph,
  GraphNode,
  GraphLink,
  ArtifactMeta,
  EdgeType,
  Confidence,
} from "../types";

// --- Small text utilities ---------------------------------------------------

const STOPWORDS = new Set(
  (
    "the a an and or of to for in on at by with from into over under is are be " +
    "as it its this that these those we our you your they their not no but so " +
    "if then than via per across against within while during after before two " +
    "one set use using used can may should must do does done well above only"
  ).split(/\s+/),
);

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\*\*/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[^a-z0-9/+\-\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function wordSet(text: string): Set<string> {
  return new Set(normalizeWords(text));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptOf(text: string, max = 220): string {
  const clean = stripMarkdown(text);
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function mapConfidence(raw: string): Confidence {
  const v = raw.trim().toLowerCase();
  if (v.startsWith("high")) return "Verified";
  if (v.startsWith("med")) return "Likely";
  return "Uncertain";
}

// --- Markdown structure helpers --------------------------------------------

interface ParsedDoc {
  h1: string;
  meta: Record<string, string>;
  sections: Record<string, string>;
}

function parseDoc(content: string): ParsedDoc {
  const lines = content.split(/\r?\n/);
  let h1 = "";
  const meta: Record<string, string> = {};
  const sections: Record<string, string> = {};
  let current = "_preamble";
  const buffers: Record<string, string[]> = { _preamble: [] };

  for (const line of lines) {
    const h1m = /^#\s+(.+?)\s*$/.exec(line);
    const h2m = /^##\s+(.+?)\s*$/.exec(line);
    const rowm = /^\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (h1m && !h1) {
      h1 = h1m[1].trim();
      continue;
    }
    if (h2m) {
      current = h2m[1].trim();
      buffers[current] = [];
      continue;
    }
    // metadata table rows (Field | Value), only in the preamble area
    if (rowm && current === "_preamble") {
      const key = rowm[1].trim();
      const val = rowm[2].trim();
      if (key && val && key !== "Field" && !/^-+$/.test(val)) {
        meta[key] = val;
      }
    }
    (buffers[current] ||= []).push(line);
  }
  for (const [k, v] of Object.entries(buffers)) sections[k] = v.join("\n").trim();
  return { h1, meta, sections };
}

/** Parse a GitHub-flavored Markdown table into rows of trimmed cells. */
function parseTable(section: string): string[][] {
  const rows: string[][] = [];
  for (const line of section.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    if (/^\|\s*-+/.test(line.trim()) || /\|\s*:?-+:?\s*\|/.test(line)) continue;
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    rows.push(cells);
  }
  return rows;
}

// --- Topic & risk classification -------------------------------------------

const TAG_RULES: { tag: string; label: string; re: RegExp }[] = [
  { tag: "backup-and-dr", label: "Backup & DR", re: /(backup|disaster recovery|\bdr\b|failover)/i },
  { tag: "immutable-storage", label: "Immutable storage", re: /(immutab|vaulted|lock period|\bworm\b)/i },
  { tag: "restore-rto", label: "Restore / RTO", re: /(hydrat|\brto\b|recovery[- ]time|return-to-full)/i },
  { tag: "oracle", label: "Oracle", re: /(oracle|\brman\b|pl\/sql|19c)/i },
  { tag: "postgresql-migration", label: "Oracle → PostgreSQL", re: /(postgres|postgresql)/i },
  { tag: "cost-optimization", label: "Cost optimization", re: /(rightsiz|reservation|savings plan|under-utili|over-provision|\bcost\b)/i },
  { tag: "kubernetes-aks", label: "Kubernetes / AKS", re: /(\baks\b|kubernetes|node pool|autoscal|\bvpa\b)/i },
  { tag: "identity-auth", label: "Identity & auth", re: /(entra id|passwordless|authentication)/i },
];

const TAG_LABELS: Record<string, string> = Object.fromEntries(
  TAG_RULES.map((r) => [r.tag, r.label]),
);

function tagsFor(text: string): string[] {
  return TAG_RULES.filter((r) => r.re.test(text)).map((r) => r.tag);
}

const RISK_RULES: { key: string; label: string; groups: string[][] }[] = [
  {
    key: "restore-hydration-rto",
    label: "Restore hydration exceeds RTO",
    groups: [
      ["hydrat", "full-performance", "return-to-full"],
      ["rto", "sla", "recovery time", "recovery-time", "recover within"],
    ],
  },
  {
    key: "immutable-lock-retention",
    label: "Immutable lock period outlives retention",
    groups: [["immutab", "lock period"], ["retention"]],
  },
];

function risksFor(text: string): { key: string; label: string }[] {
  const lower = text.toLowerCase();
  return RISK_RULES.filter((r) =>
    r.groups.every((group) => group.some((alt) => lower.includes(alt))),
  ).map(({ key, label }) => ({ key, label }));
}

/** Which canonical risk does a recommendation address? */
function risksAddressedBy(recText: string): string[] {
  const lower = recText.toLowerCase();
  const out: string[] = [];
  if (/attach-before-hydration|hydration|\brto\b|full-performance/.test(lower)) {
    out.push("restore-hydration-rto");
  }
  if (/immutab|lock period|retention/.test(lower)) {
    out.push("immutable-lock-retention");
  }
  return out;
}

// --- Graph accumulator ------------------------------------------------------

class GraphBuilder {
  private nodes = new Map<string, GraphNode>();
  private linkKeys = new Set<string>();
  private links: GraphLink[] = [];

  upsertNode(node: GraphNode): GraphNode {
    const existing = this.nodes.get(node.id);
    if (existing) {
      // merge tags
      const tags = new Set([...existing.tags, ...node.tags]);
      existing.tags = [...tags];
      if (node.customer && !existing.customer) existing.customer = node.customer;
      return existing;
    }
    this.nodes.set(node.id, { ...node, tags: [...new Set(node.tags)] });
    return this.nodes.get(node.id)!;
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  link(source: string, target: string, type: EdgeType, weight = 1): void {
    if (source === target) return;
    const key = `${source}|${target}|${type}`;
    if (this.linkKeys.has(key)) return;
    this.linkKeys.add(key);
    this.links.push({ source, target, type, weight });
  }

  allNodes(): GraphNode[] {
    return [...this.nodes.values()];
  }

  allLinks(): GraphLink[] {
    return this.links;
  }
}

// --- Main ingest ------------------------------------------------------------

function listMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(dir, f))
    .filter((p) => statSync(p).isFile());
}

const REPORT_RE = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;

export function buildGraph(dataDir: string): IngestedGraph {
  const root = dataDir;
  const g = new GraphBuilder();
  const artifacts: ArtifactMeta[] = [];

  const relPath = (abs: string): string =>
    abs.slice(root.length + 1).replace(/\\/g, "/");

  // Recommendation accumulator keyed by canonical phrase (shared across artifacts).
  interface RecAcc {
    id: string;
    label: string;
    customers: Set<string>;
    artifactIds: string[];
    owners: Set<string>;
    confidence: Confidence;
    texts: string[];
    risks: Set<string>;
  }
  const recs = new Map<string, RecAcc>();
  const confRank: Record<Confidence, number> = { Uncertain: 0, Likely: 1, Verified: 2 };

  // --- Customers ---
  const customersDir = join(root, "customers");
  const customerLabels = new Map<string, string>();
  const customerSlugs: string[] = [];
  if (existsSync(customersDir)) {
    for (const slug of readdirSync(customersDir)) {
      const cdir = join(customersDir, slug);
      if (!statSync(cdir).isDirectory()) continue;
      customerSlugs.push(slug);
      let label = titleCase(slug);
      const readme = join(cdir, "README.md");
      if (existsSync(readme)) {
        const { h1 } = parseDoc(readFileSync(readme, "utf8"));
        if (h1) label = h1.split(/—|–|-{1,2}\s/)[0].trim();
      }
      customerLabels.set(slug, label);
      g.upsertNode({ id: `customer:${slug}`, type: "Customer", label, customer: slug, tags: [] });
    }
  }

  const personId = (name: string) => `person:${slugify(name)}`;
  function ensurePerson(name: string): string {
    const id = personId(name);
    g.upsertNode({ id, type: "Person", label: name, owner: name, tags: [] });
    return id;
  }

  function ensureTopic(tag: string): string {
    const id = `topic:${tag}`;
    g.upsertNode({ id, type: "Topic", label: TAG_LABELS[tag] ?? titleCase(tag), tags: [tag] });
    return id;
  }

  function ensureRisk(key: string, label: string): string {
    const id = `risk:${key}`;
    g.upsertNode({ id, type: "Risk", label, tags: ["risk"] });
    return id;
  }

  // --- Customer reports ---
  const customerContact = new Map<string, string>();
  for (const slug of customerSlugs) {
    const cdir = join(customersDir, slug);
    for (const file of readdirSync(cdir)) {
      const m = REPORT_RE.exec(file);
      if (!m) continue; // skip README.md and non-dated files
      const date = m[1];
      const abs = join(cdir, file);
      const id = relPath(abs);
      const content = readFileSync(abs, "utf8");
      const doc = parseDoc(content);
      const title = doc.h1 || titleCase(m[2]);
      // Classify on the artifact's own content, not its cross-reference links.
      const classifyText = [
        doc.h1,
        ...Object.entries(doc.sections)
          .filter(([k]) => k !== "Related")
          .map(([, v]) => v),
      ].join("\n");
      const tags = tagsFor(classifyText);
      const excerpt = excerptOf(doc.sections["Summary"] || doc.sections["_preamble"] || title);
      if (doc.meta["Customer contact"] && !customerContact.has(slug)) {
        customerContact.set(slug, doc.meta["Customer contact"]);
      }

      g.upsertNode({
        id,
        type: "Artifact",
        label: title,
        customer: slug,
        tags,
        date,
        artifactPath: id,
      });
      g.link(id, `customer:${slug}`, "derived-from");
      artifacts.push({ path: id, title, customer: slug, date, type: "report", tags, excerpt });

      // Topics
      for (const tag of tags) {
        const tid = ensureTopic(tag);
        g.link(id, tid, "mentions");
        g.link(`customer:${slug}`, tid, "mentions");
      }
      // Risks
      for (const r of risksFor(classifyText)) {
        const rid = ensureRisk(r.key, r.label);
        g.link(id, rid, "mentions");
        g.link(`customer:${slug}`, rid, "shares-risk");
      }
      // People from metadata
      for (const field of ["Specialist", "Customer contact"]) {
        if (doc.meta[field]) {
          const pid = ensurePerson(doc.meta[field]);
          g.link(pid, id, "mentions");
        }
      }
      // Recommendations table
      const recSection = doc.sections["Recommendations"];
      if (recSection) {
        const rows = parseTable(recSection);
        // Skip the header row if present (first cell "#")
        for (const cells of rows) {
          if (cells.length < 3) continue;
          // Expect [#, Recommendation, Owner, Confidence]; tolerate a missing id column.
          let recText: string, owner: string, conf: string;
          if (cells.length >= 4) {
            [, recText, owner, conf] = cells;
          } else {
            [recText, owner, conf] = cells;
          }
          if (!recText || /^recommendation$/i.test(recText)) continue;
          const bold = /\*\*(.+?)\*\*/.exec(recText);
          const canonicalSource = bold ? bold[1] : recText.split(/\s+—\s+|\s+–\s+/)[0];
          const key = normalizeWords(canonicalSource).join(" ");
          if (!key) continue;
          const label = stripMarkdown(canonicalSource);
          const confidence = mapConfidence(conf || "");
          const acc =
            recs.get(key) ??
            ({
              id: `rec:${slugify(label).slice(0, 60)}`,
              label,
              customers: new Set<string>(),
              artifactIds: [],
              owners: new Set<string>(),
              confidence,
              texts: [],
              risks: new Set<string>(),
            } satisfies RecAcc);
          acc.customers.add(slug);
          acc.artifactIds.push(id);
          if (owner) acc.owners.add(owner);
          acc.texts.push(stripMarkdown(recText));
          if (confRank[confidence] > confRank[acc.confidence]) acc.confidence = confidence;
          for (const rk of risksAddressedBy(recText)) acc.risks.add(rk);
          recs.set(key, acc);
        }
      }
    }
  }

  // --- Materialize recommendation nodes + edges ---
  const actionsForMatch: { id: string; words: Set<string> }[] = [];

  // Set each customer's primary contact as its owner.
  for (const [slug, contact] of customerContact) {
    const node = g.getNode(`customer:${slug}`);
    if (node) node.owner = contact;
  }

  // --- Tasks (tracked actions) ---
  const tasksFile = join(root, "tasks", "open.md");
  const trackedActions: { text: string; owner: string; due: string; slug: string }[] = [];
  if (existsSync(tasksFile)) {
    const content = readFileSync(tasksFile, "utf8");
    let currentSlug = "";
    for (const line of content.split(/\r?\n/)) {
      const h2 = /^##\s+(.+?)\s*$/.exec(line);
      if (h2) {
        const name = h2[1].trim();
        currentSlug =
          customerSlugs.find((s) => customerLabels.get(s) === name) ??
          customerSlugs.find((s) => name.toLowerCase().includes(s)) ??
          "";
        continue;
      }
      const task = /^[-*]\s*\[[ x]\]\s*(.+?)(?:\s*\(owner:\s*([^,]+?),\s*due:\s*([^)]+?)\))?\s*$/.exec(line);
      if (task) {
        trackedActions.push({
          text: task[1].trim(),
          owner: (task[2] || "").trim(),
          due: (task[3] || "").trim(),
          slug: currentSlug,
        });
      }
    }
  }
  trackedActions.forEach((t, i) => {
    const id = `action:${t.slug || "portfolio"}:${i}`;
    g.upsertNode({
      id,
      type: "Action",
      label: t.text,
      customer: t.slug || undefined,
      owner: t.owner || undefined,
      date: t.due || undefined,
      tags: ["action"],
    });
    if (t.slug) g.link(`customer:${t.slug}`, id, "follows-up");
    if (t.owner) g.link(ensurePerson(t.owner), id, "owns");
    actionsForMatch.push({ id, words: wordSet(t.text) });
  });

  // Recommendation nodes (now that we know tracked actions for the tracked flag)
  for (const acc of recs.values()) {
    const repText = acc.texts.reduce((a, b) => (b.length > a.length ? b : a), "");
    const recWords = wordSet(repText);
    const tracked = actionsForMatch.some((a) => jaccard(recWords, a.words) >= 0.33);
    const node = g.upsertNode({
      id: acc.id,
      type: "Recommendation",
      label: acc.label,
      tags: ["recommendation"],
      confidence: acc.confidence,
      tracked,
      customerCount: acc.customers.size,
      owner: [...acc.owners][0],
    });
    node.tracked = tracked;
    node.customerCount = acc.customers.size;
    for (const aid of acc.artifactIds) g.link(acc.id, aid, "derived-from");
    for (const slug of acc.customers) g.link(`customer:${slug}`, acc.id, "recommends");
    for (const owner of acc.owners) g.link(ensurePerson(owner), acc.id, "owns");
    for (const rk of acc.risks) {
      const rl = RISK_RULES.find((r) => r.key === rk);
      if (rl && g.getNode(`risk:${rk}`)) g.link(acc.id, `risk:${rk}`, "addresses");
    }
  }

  // --- Meeting + prep artifacts (recency signals) ---
  for (const [dir, type] of [
    [join(root, "meetings"), "meeting"],
    [join(root, "prep"), "prep"],
  ] as const) {
    for (const abs of listMarkdown(dir)) {
      const id = relPath(abs);
      const fname = basename(abs);
      const dm = /^(\d{4}-\d{2}-\d{2})/.exec(fname);
      const date = dm ? dm[1] : "";
      const content = readFileSync(abs, "utf8");
      const doc = parseDoc(content);
      const title = doc.h1 || titleCase(fname.replace(/\.md$/, ""));
      const tags = tagsFor(content);
      const excerpt = excerptOf(
        doc.sections["Transcript (excerpt)"] ||
          doc.sections["Cross-customer signal of the day"] ||
          doc.sections["_preamble"] ||
          title,
      );
      g.upsertNode({ id, type: "Artifact", label: title, tags, date, artifactPath: id });
      artifacts.push({ path: id, title, customer: "", date, type, tags, excerpt });
      for (const tag of tags) g.link(id, ensureTopic(tag), "mentions");
      // Link to any customers mentioned by label
      for (const slug of customerSlugs) {
        const label = customerLabels.get(slug)!;
        if (content.includes(label) || fname.includes(slug)) {
          g.link(id, `customer:${slug}`, "derived-from");
        }
      }
    }
  }

  // --- Related links between artifacts ---
  for (const slug of customerSlugs) {
    const cdir = join(customersDir, slug);
    for (const file of readdirSync(cdir)) {
      if (!REPORT_RE.test(file)) continue;
      const abs = join(cdir, file);
      const id = relPath(abs);
      const doc = parseDoc(readFileSync(abs, "utf8"));
      const related = doc.sections["Related"];
      if (!related) continue;
      const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;
      let lm: RegExpExecArray | null;
      while ((lm = linkRe.exec(related))) {
        const target = join(dirname(abs), lm[1]);
        const targetId = target.slice(root.length + 1).replace(/\\/g, "/");
        if (g.getNode(targetId)) g.link(id, targetId, "derived-from");
      }
    }
  }

  // --- Synthetic customer<->customer edges for shared topics / risks ---
  const adjacency = new Map<string, Set<string>>(); // nodeId -> customer slugs
  for (const link of g.allLinks()) {
    for (const [a, b] of [
      [link.source, link.target],
      [link.target, link.source],
    ]) {
      const node = g.getNode(a);
      if (node?.type === "Customer") {
        (adjacency.get(b) ?? adjacency.set(b, new Set()).get(b)!).add(node.customer!);
      }
    }
  }
  for (const node of g.allNodes()) {
    if (node.type !== "Topic" && node.type !== "Risk") continue;
    const custs = [...(adjacency.get(node.id) ?? [])].sort();
    node.customerCount = custs.length;
    if (custs.length < 2) continue;
    const edgeType: EdgeType = node.type === "Risk" ? "shares-risk" : "shares-topic";
    for (let i = 0; i < custs.length; i++) {
      for (let j = i + 1; j < custs.length; j++) {
        g.link(`customer:${custs[i]}`, `customer:${custs[j]}`, edgeType, 2);
      }
    }
  }

  // --- Customer tag aggregation (for tooltips) ---
  for (const slug of customerSlugs) {
    const node = g.getNode(`customer:${slug}`)!;
    const tags = new Set<string>();
    for (const a of artifacts) if (a.customer === slug) a.tags.forEach((t) => tags.add(t));
    node.tags = [...tags];
  }

  // --- Deterministic ordering ---
  const typeOrder: Record<string, number> = {
    Customer: 0,
    Topic: 1,
    Risk: 2,
    Recommendation: 3,
    Artifact: 4,
    Action: 5,
    Person: 6,
  };
  const nodes = g
    .allNodes()
    .sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.id.localeCompare(b.id));
  const links = g
    .allLinks()
    .sort(
      (a, b) =>
        String(a.source).localeCompare(String(b.source)) ||
        String(a.target).localeCompare(String(b.target)) ||
        a.type.localeCompare(b.type),
    );
  artifacts.sort((a, b) => a.path.localeCompare(b.path));

  return { nodes, links, artifacts };
}
