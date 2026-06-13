/**
 * Unit tests for the Foundry IQ reasoner in deterministic (mock) mode.
 *
 * FOUNDRY_LIVE is forced off and the reasoner is imported dynamically so this
 * suite never attempts a network call even if a local .env enables live mode.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeGraph } from "./fixture.js";

process.env.FOUNDRY_LIVE = "false";
const { reason } = await import("../src/iq/foundry.js");

test("pattern-hunt reasons over the graph and stays mock", async () => {
  const res = await reason("which customers share backup restore risk?", "pattern-hunt", makeGraph());
  assert.equal(res.live, false);
  assert.equal(typeof res.detail, "string");
  assert.ok(res.narrative.segments.length > 0);
  assert.ok(res.highlightedNodeIds.includes("risk:r1"));
  assert.ok(res.candidateActions.length > 0);
});

test("executive-story produces a multi-segment narrative", async () => {
  const res = await reason("build a board narrative for this period", "executive-story", makeGraph());
  assert.equal(res.live, false);
  assert.ok(res.narrative.segments.length >= 1);
  assert.ok(res.narrative.title.toLowerCase().includes("executive"));
});

test("playbook-remix returns grounded candidate actions", async () => {
  const res = await reason("remix a proven fix onto another customer", "playbook-remix", makeGraph());
  assert.equal(res.live, false);
  assert.ok(res.candidateActions.length > 0);
});

test("every narrative segment carries a confidence label", async () => {
  const res = await reason("show repeated untracked recommendations", "pattern-hunt", makeGraph());
  for (const s of res.narrative.segments) {
    assert.ok(["Verified", "Likely", "Uncertain"].includes(s.confidence));
  }
});

test("reasoning is deterministic in mock mode", async () => {
  const g = makeGraph();
  const a = await reason("which customers share backup restore risk?", "pattern-hunt", g);
  const b = await reason("which customers share backup restore risk?", "pattern-hunt", g);
  assert.deepEqual(a.narrative, b.narrative);
  assert.deepEqual(a.highlightedNodeIds, b.highlightedNodeIds);
});
