import type { Confidence, Narrative } from "../types";

function badgeClass(c: Confidence): string {
  if (c === "Verified") return "badge-verified";
  if (c === "Likely") return "badge-likely";
  return "badge-uncertain";
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

interface Props {
  narrative: Narrative | null;
  loading: boolean;
}

export function StoryPane({ narrative, loading }: Props) {
  return (
    <section className="pane pane-story">
      <div className="pane-head">
        <span>Narrative</span>
      </div>
      <div className="pane-body">
        {loading ? (
          <div className="placeholder">
            <span className="spinner" /> Composing a grounded narrative…
          </div>
        ) : !narrative ? (
          <div className="placeholder">Ask a question to generate a source-grounded narrative.</div>
        ) : (
          <div className="story">
            <h2 className="story-title">{narrative.title}</h2>
            <p className="story-summary">{narrative.summary}</p>
            {narrative.segments.map((s, i) => (
              <div className="segment" key={i}>
                <p className="segment-text">{s.text}</p>
                <div className="segment-meta">
                  <span className={`badge ${badgeClass(s.confidence)}`}>{s.confidence}</span>
                  {s.citations.map((c, j) => (
                    <span
                      className="source-badge"
                      key={`${c.artifactPath}-${j}`}
                      title={`${c.title}${c.date ? ` · ${c.date}` : ""}${c.excerpt ? `\n${c.excerpt}` : ""}`}
                    >
                      {basename(c.artifactPath)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
