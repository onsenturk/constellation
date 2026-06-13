/**
 * Foundry IQ — live Azure AI Foundry client (Microsoft Entra ID, keyless).
 *
 * This is the real model call behind FOUNDRY_LIVE=true. It is deliberately
 * narrow: the deterministic graph reasoning (patterns.ts + foundry.ts) does the
 * multi-hop retrieval and owns every citation; this module only asks the model
 * to *re-narrate* those already-grounded findings. The model never sees a tool,
 * never picks a source, and is instructed to use only the supplied facts — so a
 * live narrative cannot invent a customer, number, or citation.
 *
 * SDK pattern per Microsoft Learn: `AzureOpenAI` + `@azure/identity`
 * `getBearerTokenProvider(new DefaultAzureCredential(), scope)`.
 * Azure SDKs are imported dynamically so the default (mock) path stays offline.
 */

import { config } from "../config.js";
import type { AzureOpenAI } from "openai";

export interface NarrationInput {
  /** The end-user question, for tone/relevance only. */
  question: string;
  title: string;
  summary: string;
  /** Grounded finding lines, in order: `(n) [Confidence] text`. */
  facts: string[];
  /** Supporting source excerpts (title: excerpt). */
  sources: string[];
  /** Exact number of segments the model must return, one per fact. */
  segmentCount: number;
}

export interface NarrationOutput {
  title: string;
  summary: string;
  /** Exactly `segmentCount` rewritten segment texts, in the same order. */
  segmentTexts: string[];
  totalTokens?: number;
}

let clientPromise: Promise<AzureOpenAI> | null = null;

async function getClient(): Promise<AzureOpenAI> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { AzureOpenAI } = await import("openai");
      const { DefaultAzureCredential, getBearerTokenProvider } = await import("@azure/identity");
      const azureADTokenProvider = getBearerTokenProvider(
        new DefaultAzureCredential(),
        config.foundry.scope,
      );
      return new AzureOpenAI({
        endpoint: config.foundry.endpoint,
        deployment: config.foundry.deployment,
        apiVersion: config.foundry.apiVersion,
        azureADTokenProvider,
      });
    })();
  }
  return clientPromise;
}

const SYSTEM_PROMPT = [
  "You are Foundry IQ, a grounded reasoning layer for a customer-engagement knowledge graph.",
  "You receive pre-computed, source-verified findings and must re-narrate them as a crisp,",
  "executive-ready story. Strict rules:",
  "1. Use ONLY the supplied facts and sources. Never invent customers, numbers, dates, risks,",
  "   recommendations, or citations, and never contradict a fact.",
  "2. Preserve the meaning and the ORDER of the findings exactly.",
  "3. Return exactly N rewritten segment texts — one per numbered finding, same order.",
  "4. Keep each segment to one or two sentences; do not add confidence labels or source names",
  "   (those are attached downstream).",
  'Respond with ONLY minified JSON: {"title":string,"summary":string,"segments":string[]}',
  "where segments.length === N.",
].join(" ");

/** Strip code fences and isolate the JSON object a model may wrap in prose. */
function extractJson(raw: string): string {
  const fenced = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return fenced;
  return fenced.slice(start, end + 1);
}

/**
 * Call the configured Azure AI Foundry deployment to re-narrate grounded
 * findings. Throws on transport, auth, or contract-violation errors so the
 * caller can surface an honest "served deterministic narrative" fallback.
 */
export async function narrate(input: NarrationInput): Promise<NarrationOutput> {
  const client = await getClient();

  const userPayload = {
    question: input.question,
    draftTitle: input.title,
    draftSummary: input.summary,
    findings: input.facts,
    sources: input.sources,
    requiredSegments: input.segmentCount,
  };

  const completion = await client.chat.completions.create({
    model: config.foundry.deployment,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(userPayload) },
    ],
    // gpt-5.x / reasoning models reject `max_tokens`; `max_completion_tokens`
    // is accepted across current chat models on api-version 2024-10-21+.
    max_completion_tokens: 1500,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  if (!raw.trim()) throw new Error("empty completion");

  const parsed = JSON.parse(extractJson(raw)) as {
    title?: unknown;
    summary?: unknown;
    segments?: unknown;
  };

  const segments = Array.isArray(parsed.segments) ? parsed.segments : [];
  const segmentTexts = segments.map((s) => String(s ?? "").trim()).filter(Boolean);

  return {
    title: typeof parsed.title === "string" ? parsed.title.trim() : "",
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    segmentTexts,
    totalTokens: completion.usage?.total_tokens,
  };
}
