import type { GraphData, QueryRequest, QueryResponse } from "../types";

async function asError(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? `Request failed (${res.status})`);
}

/** Load the base constellation for the initial render. */
export async function fetchGraph(): Promise<GraphData> {
  const res = await fetch("/api/graph");
  if (!res.ok) return asError(res);
  return (await res.json()) as GraphData;
}

/** Run a grounded query through the IQ pipeline. */
export async function runQuery(req: QueryRequest): Promise<QueryResponse> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) return asError(res);
  return (await res.json()) as QueryResponse;
}
