import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

import type { GraphData, NodeType } from "../types";

const COLORS: Record<NodeType, string> = {
  Customer: "#58a6ff",
  Topic: "#3fb950",
  Risk: "#f85149",
  Recommendation: "#d29922",
  Action: "#a371f7",
  Artifact: "#8b949e",
  Person: "#56d4dd",
};

const SIZE: Record<NodeType, number> = {
  Customer: 7,
  Risk: 6,
  Topic: 5.5,
  Recommendation: 5,
  Artifact: 3.5,
  Action: 3.5,
  Person: 3,
};

interface Props {
  data: GraphData;
  highlighted: string[];
}

export function Constellation({ data, highlighted }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Clone so the force engine can mutate source/target without touching state.
  const graph = useMemo(
    () => ({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    }),
    [data],
  );

  const highlightSet = useMemo(() => new Set(highlighted), [highlighted]);

  const neighborSet = useMemo(() => {
    if (!selected) return null;
    const set = new Set<string>([selected]);
    for (const l of data.links) {
      const s = typeof l.source === "string" ? l.source : l.source.id;
      const t = typeof l.target === "string" ? l.target : l.target.id;
      if (s === selected) set.add(t);
      if (t === selected) set.add(s);
    }
    return set;
  }, [selected, data]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || graph.nodes.length === 0) return;
    const t = setTimeout(() => fg.zoomToFit?.(500, 50), 600);
    return () => clearTimeout(t);
  }, [graph]);

  const isFocused = (id: string): boolean =>
    neighborSet ? neighborSet.has(id) : highlightSet.size ? highlightSet.has(id) : true;

  return (
    <div className="graph-host" ref={hostRef}>
      {size.w > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={graph}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={1}
          cooldownTicks={120}
          d3VelocityDecay={0.3}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onNodeClick={(node: any) => setSelected((prev) => (prev === node.id ? null : node.id))}
          onBackgroundClick={() => setSelected(null)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkColor={(l: any) => {
            const s = typeof l.source === "object" ? l.source.id : l.source;
            const t = typeof l.target === "object" ? l.target.id : l.target;
            return isFocused(s) && isFocused(t) ? "rgba(139,148,158,0.4)" : "rgba(139,148,158,0.07)";
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkWidth={(l: any) => (l.type === "shares-risk" || l.type === "shares-topic" ? 1.6 : 0.5)}
          nodeCanvasObjectMode={() => "replace"}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            const r = SIZE[node.type as NodeType] ?? 4;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI);
            ctx.fill();
          }}
          nodeCanvasObject={(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            node: any,
            ctx: CanvasRenderingContext2D,
            globalScale: number,
          ) => {
            const type = node.type as NodeType;
            const color = COLORS[type] ?? "#8b949e";
            const r = SIZE[type] ?? 4;
            const focused = isFocused(node.id);
            const hot = highlightSet.has(node.id) || node.id === selected;

            ctx.globalAlpha = focused ? 1 : 0.18;
            if (hot) {
              ctx.shadowColor = color;
              ctx.shadowBlur = 18;
            }
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.shadowBlur = 0;

            if (hot) {
              ctx.lineWidth = 1.4;
              ctx.strokeStyle = "rgba(255,255,255,0.85)";
              ctx.stroke();
            }

            const showLabel =
              type === "Customer" || type === "Risk" || type === "Topic" || hot || globalScale > 2.2;
            if (showLabel && focused) {
              const fontSize = Math.max(10 / globalScale, 2.6);
              ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = "rgba(230,237,243,0.92)";
              const label = String(node.label);
              const text = label.length > 30 ? label.slice(0, 29) + "…" : label;
              ctx.fillText(text, node.x, node.y + r + 1.5);
            }
            ctx.globalAlpha = 1;
          }}
        />
      )}
      <div className="graph-hint">click a star to trace its links · scroll to zoom</div>
      <Legend />
    </div>
  );
}

function Legend() {
  const items = Object.entries(COLORS) as [NodeType, string][];
  return (
    <div className="legend">
      {items.map(([label, color]) => (
        <div className="legend-item" key={label}>
          <span className="legend-dot" style={{ background: color }} />
          {label}
        </div>
      ))}
    </div>
  );
}
