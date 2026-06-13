/**
 * Unit tests for the deterministic cross-customer pattern engine.
 * Run via: npm run test  (node --import tsx --test)
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  indexGraph,
  sharedRisks,
  sharedTopics,
  repeatedRecommendations,
  untrackedRepeatedRecs,
  timeline,
  citationFor,
  customerLabel,
  openActionStats,
} from "../src/graph/patterns.js";
import { makeGraph } from "./fixture.js";

test("indexGraph builds bidirectional neighbor edges", () => {
  const g = makeGraph();
  const idx = indexGraph(g);
  const riskNeighbors = (idx.neighbors.get("risk:r1") ?? []).map((n) => n.node.id);
  assert.ok(riskNeighbors.includes("customer:alpha"));
  assert.ok(riskNeighbors.includes("customer:beta"));
  // Reverse direction is present too (link was customer -> risk).
  const alphaNeighbors = (idx.neighbors.get("customer:alpha") ?? []).map((n) => n.node.id);
  assert.ok(alphaNeighbors.includes("risk:r1"));
});

test("sharedRisks returns only risks spanning >= 2 customers", () => {
  const g = makeGraph();
  const idx = indexGraph(g);
  const risks = sharedRisks(g, idx);
  assert.equal(risks.length, 1);
  assert.equal(risks[0].node.id, "risk:r1");
  assert.deepEqual(risks[0].customers, ["alpha", "beta"]);
  assert.deepEqual(risks[0].customerLabels, ["Alpha Corp", "Beta LLC"]);
});

test("sharedTopics returns only topics spanning >= 2 customers", () => {
  const g = makeGraph();
  const idx = indexGraph(g);
  const topics = sharedTopics(g, idx);
  assert.equal(topics.length, 1);
  assert.equal(topics[0].node.id, "topic:t1");
  assert.deepEqual(topics[0].customers, ["beta", "gamma"]);
});

test("repeatedRecommendations includes multi-customer recs and excludes single-customer recs", () => {
  const g = makeGraph();
  const idx = indexGraph(g);
  const repeated = repeatedRecommendations(g, idx);
  const ids = repeated.map((r) => r.node.id);
  assert.ok(ids.includes("rec:shared"));
  assert.ok(!ids.includes("rec:solo"));
});

test("untrackedRepeatedRecs surfaces the recurring-but-untracked recommendation", () => {
  const g = makeGraph();
  const idx = indexGraph(g);
  const untracked = untrackedRepeatedRecs(g, idx);
  assert.equal(untracked.length, 1);
  assert.equal(untracked[0].node.id, "rec:shared");
  assert.equal(untracked[0].tracked, false);
});

test("citationFor resolves metadata by path and falls back when unknown", () => {
  const g = makeGraph();
  const idx = indexGraph(g);
  const known = citationFor(idx, "sample-data/customers/alpha/a1.md");
  assert.equal(known.title, "Alpha report");
  assert.equal(known.excerpt, "alpha restore excerpt");

  const unknown = citationFor(idx, "nope/missing.md", "Fallback Title");
  assert.equal(unknown.title, "Fallback Title");
  assert.equal(unknown.excerpt, "");
});

test("customerLabel maps a slug to its display label", () => {
  const g = makeGraph();
  const idx = indexGraph(g);
  assert.equal(customerLabel(idx, "alpha"), "Alpha Corp");
  assert.equal(customerLabel(idx, "missing"), "missing");
});

test("timeline orders artifacts oldest-first", () => {
  const g = makeGraph();
  const dates = timeline(g).map((a) => a.date);
  assert.deepEqual(dates, ["2026-05-18", "2026-05-20", "2026-05-22"]);
});

test("openActionStats counts actions and computes age + per-customer breakdown", () => {
  const g = makeGraph();
  const stats = openActionStats(g);
  assert.equal(stats.count, 1);
  assert.equal(stats.byCustomer.alpha, 1);
  assert.ok(stats.oldestDays > 0);
});

test("pattern detection is deterministic across repeated calls", () => {
  const g = makeGraph();
  const a = sharedRisks(g, indexGraph(g));
  const b = sharedRisks(g, indexGraph(g));
  assert.deepEqual(
    a.map((c) => ({ id: c.node.id, customers: c.customers })),
    b.map((c) => ({ id: c.node.id, customers: c.customers })),
  );
});
