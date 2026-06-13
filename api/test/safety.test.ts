/**
 * Unit tests for safe-demo redaction (the safety boundary).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { redactResponse } from "../src/safety/redact.js";
import { makeGraph } from "./fixture.js";
import type { QueryResponse } from "../src/types.js";

function sampleResponse(): QueryResponse {
  return {
    graph: {
      nodes: [{ id: "person:p1", type: "Person", label: "Dana Alpha", tags: [] }],
      links: [],
    },
    narrative: {
      title: "Portfolio read",
      summary: "Dana Alpha leads this; reach them at dana@example.com.",
      segments: [
        {
          text: "Dana Alpha owns the follow-up; email dana@example.com to confirm.",
          confidence: "Likely",
          citations: [
            { artifactPath: "x.md", title: "x", date: "2026-05-20", excerpt: "Dana Alpha noted the risk." },
          ],
        },
      ],
    },
    actions: [
      {
        id: "action-1",
        title: "Ping Dana Alpha",
        owner: "Dana Alpha",
        dueDate: "2026-06-16",
        confidence: "Likely",
        sourcePath: "x.md",
        rationale: "Because Dana Alpha raised it.",
      },
    ],
    signals: [],
    highlightedNodeIds: [],
  };
}

test("redaction masks person names to initials across narrative, actions and graph", () => {
  const out = redactResponse(sampleResponse(), makeGraph());
  assert.ok(out.narrative.summary.includes("D.A."));
  assert.ok(!out.narrative.summary.includes("Dana Alpha"));
  assert.equal(out.actions[0].owner, "D.A.");
  assert.ok(!out.actions[0].title.includes("Dana Alpha"));
  assert.equal(out.graph.nodes[0].label, "D.A.");
});

test("redaction strips email addresses", () => {
  const out = redactResponse(sampleResponse(), makeGraph());
  assert.ok(!out.narrative.summary.includes("dana@example.com"));
  assert.ok(out.narrative.summary.includes("[redacted]"));
  assert.ok(!out.narrative.segments[0].text.includes("@example.com"));
});

test("redaction also masks names inside citation excerpts", () => {
  const out = redactResponse(sampleResponse(), makeGraph());
  assert.ok(!out.narrative.segments[0].citations[0].excerpt.includes("Dana Alpha"));
});
