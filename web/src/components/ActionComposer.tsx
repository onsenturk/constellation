import type { ActionCard, Confidence } from "../types";

function badgeClass(c: Confidence): string {
  if (c === "Verified") return "badge-verified";
  if (c === "Likely") return "badge-likely";
  return "badge-uncertain";
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

interface Props {
  actions: ActionCard[];
  loading: boolean;
}

export function ActionComposer({ actions, loading }: Props) {
  return (
    <section className="pane pane-actions">
      <div className="pane-head">
        <span>Action Composer</span>
        {actions.length > 0 && <span className="badge badge-uncertain">{actions.length}</span>}
      </div>
      <div className="pane-body">
        {loading ? (
          <div className="placeholder">
            <span className="spinner" /> Proposing grounded actions…
          </div>
        ) : actions.length === 0 ? (
          <div className="placeholder">Grounded next steps appear here after a query.</div>
        ) : (
          <div className="actions">
            {actions.map((a) => (
              <div className="action-card" key={a.id}>
                <p className="action-title">{a.title}</p>
                <div className="action-meta">
                  <span className="who">owner: {a.owner}</span>
                  <span>due {a.dueDate}</span>
                  <span className={`badge ${badgeClass(a.confidence)}`}>{a.confidence}</span>
                </div>
                <p className="action-rationale">{a.rationale}</p>
                {a.sourcePath && (
                  <span className="source-badge" title={a.sourcePath}>
                    {basename(a.sourcePath)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
