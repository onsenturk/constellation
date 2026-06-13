import type { IqSignal } from "../types";

const DEFAULTS: IqSignal[] = [
  {
    iq: "foundry",
    label: "Foundry IQ — multi-hop reasoning",
    detail: "Grounded retrieval + reasoning over the knowledge graph.",
    live: false,
  },
  {
    iq: "work",
    label: "Work IQ — recency & owners",
    detail: "Meeting, owner and recency context (sample data).",
    live: false,
  },
  {
    iq: "fabric",
    label: "Fabric IQ — recurrence & velocity",
    detail: "Trend and recurrence analytics over time (sample data).",
    live: false,
  },
];

export function SignalBar({ signals }: { signals: IqSignal[] }) {
  const items = signals.length ? signals : DEFAULTS;
  return (
    <div className="signals">
      {items.map((s) => (
        <div key={s.iq} className={`signal iq-${s.iq}`}>
          <div className="signal-head">
            <span className="signal-label">{s.label}</span>
            <span className={`live-badge ${s.live ? "live" : "mock"}`}>{s.live ? "Live" : "Mock"}</span>
          </div>
          <div className="signal-detail">{s.detail}</div>
        </div>
      ))}
    </div>
  );
}
