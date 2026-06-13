import { useEffect, useState } from "react";

import { ActionComposer } from "./components/ActionComposer";
import { Constellation } from "./components/Constellation";
import { PromptBar } from "./components/PromptBar";
import { SignalBar } from "./components/SignalBar";
import { StoryPane } from "./components/StoryPane";
import { fetchGraph, runQuery } from "./lib/api";
import type { GraphData, QueryResponse, SceneMode } from "./types";

const EMPTY_GRAPH: GraphData = { nodes: [], links: [] };

interface RunOpts {
  prompt?: string;
  mode?: SceneMode;
  safe?: boolean;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<SceneMode>("pattern-hunt");
  const [safeDemo, setSafeDemo] = useState(false);
  const [baseGraph, setBaseGraph] = useState<GraphData>(EMPTY_GRAPH);
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGraph()
      .then(setBaseGraph)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load graph"));
  }, []);

  async function run(opts: RunOpts = {}): Promise<void> {
    const q = (opts.prompt ?? prompt).trim();
    const m = opts.mode ?? mode;
    const safe = opts.safe ?? safeDemo;
    if (opts.prompt !== undefined) setPrompt(opts.prompt);
    if (opts.mode !== undefined) setMode(opts.mode);
    if (opts.safe !== undefined) setSafeDemo(opts.safe);
    if (!q) {
      setError("Enter a question first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResponse(await runQuery({ prompt: q, mode: m, safeDemo: safe }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }

  const hasPrompt = prompt.trim().length > 0;
  const graph = response?.graph ?? baseGraph;
  const highlighted = response?.highlightedNodeIds ?? [];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">✶</span>
          <span className="name">Constellation</span>
          <span className="tagline">Turn scattered expertise into a living map you can ask questions.</span>
        </div>
        <label className="safe-toggle" title="Mask owners and block export for safe demos">
          <input
            type="checkbox"
            checked={safeDemo}
            onChange={(e) => {
              const checked = e.target.checked;
              if (response && hasPrompt) run({ safe: checked });
              else setSafeDemo(checked);
            }}
          />
          Safe demo
        </label>
      </header>

      <PromptBar
        prompt={prompt}
        mode={mode}
        loading={loading}
        onPrompt={setPrompt}
        onMode={(m) => (hasPrompt ? run({ mode: m }) : setMode(m))}
        onRun={(p) => run(p !== undefined ? { prompt: p } : {})}
      />

      <SignalBar signals={response?.signals ?? []} />

      {error && <div className="error-banner">{error}</div>}

      <main className="panes">
        <section className="pane pane-graph">
          <div className="pane-head">
            <span>Constellation</span>
            <span style={{ color: "var(--faint)", textTransform: "none", fontWeight: 400 }}>
              {graph.nodes.length} nodes · {graph.links.length} links
            </span>
          </div>
          <div className="pane-body">
            {graph.nodes.length > 0 ? (
              <Constellation data={graph} highlighted={highlighted} />
            ) : (
              <div className="placeholder">Loading constellation…</div>
            )}
          </div>
        </section>

        <StoryPane narrative={response?.narrative ?? null} loading={loading} />
        <ActionComposer actions={response?.actions ?? []} loading={loading} />
      </main>
    </div>
  );
}
