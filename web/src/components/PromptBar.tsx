import type { SceneMode } from "../types";

const MODES: { id: SceneMode; label: string }[] = [
  { id: "pattern-hunt", label: "Pattern Hunt" },
  { id: "executive-story", label: "Executive Story" },
  { id: "playbook-remix", label: "Playbook Remix" },
];

const EXAMPLES = [
  "Which customers likely share backup-restore risk patterns?",
  "Build a 5-slide narrative from this week's cross-customer signals.",
  "Show repeated recommendations not yet converted into tracked actions.",
];

interface Props {
  prompt: string;
  mode: SceneMode;
  loading: boolean;
  onPrompt: (value: string) => void;
  onMode: (mode: SceneMode) => void;
  onRun: (prompt?: string) => void;
}

export function PromptBar({ prompt, mode, loading, onPrompt, onMode, onRun }: Props) {
  return (
    <>
      <form
        className="promptbar"
        onSubmit={(e) => {
          e.preventDefault();
          onRun();
        }}
      >
        <input
          className="prompt-input"
          placeholder="Ask your knowledge map…  e.g. which customers share a hidden risk?"
          value={prompt}
          maxLength={2000}
          onChange={(e) => onPrompt(e.target.value)}
        />
        <div className="modes" role="tablist" aria-label="Scene mode">
          {MODES.map((m) => (
            <button
              type="button"
              key={m.id}
              className={`mode-btn ${mode === m.id ? "active" : ""}`}
              aria-pressed={mode === m.id}
              onClick={() => onMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button className="run-btn" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : "Run"}
        </button>
      </form>
      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="example-chip" type="button" onClick={() => onRun(ex)}>
            {ex}
          </button>
        ))}
      </div>
    </>
  );
}
