"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Maximize2, Minus, Plus } from "lucide-react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type VaultNode = {
  id: string;
  slug: string;
  title: string;
  kind: string;
};

type GraphNodeRuntime = VaultNode & {
  val: number;
  neighbors: GraphNodeRuntime[];
  links: GraphLinkRuntime[];
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

type GraphLinkRuntime = {
  source: string | GraphNodeRuntime;
  target: string | GraphNodeRuntime;
};

const KIND_STYLE: Record<string, { color: string; label: string }> = {
  practitioner: { color: "#CC0641", label: "Audioprothésiste" },
  assistant: { color: "#D97706", label: "Assistant" },
  center: { color: "#2563EB", label: "Centre" },
  patient: { color: "#059669", label: "Patient" },
  pattern: { color: "#E11D48", label: "Pattern" },
  session: { color: "#7C3AED", label: "Session" },
  index: { color: "#64748B", label: "Index" },
};

const FALLBACK_COLOR = "#64748B";

function nodeRadius(node: { val?: number }) {
  return Math.max(4, Math.sqrt(node.val ?? 1) * 2.6);
}

export function VaultGraph({
  nodes,
  edges,
}: {
  nodes: VaultNode[];
  edges: { source: string; target: string }[];
}) {
  const router = useRouter();
  const fgRef = useRef<{
    zoomToFit: (ms?: number, padding?: number) => void;
    zoom: (k?: number, ms?: number) => number;
    centerAt: (x?: number, y?: number, ms?: number) => void;
    d3ReheatSimulation: () => void;
    graph2ScreenCoords: (x: number, y: number) => { x: number; y: number };
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverNodeRef = useRef<GraphNodeRuntime | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [activeKinds, setActiveKinds] = useState<Set<string>>(
    () => new Set(Object.keys(KIND_STYLE))
  );

  const data = useMemo(() => {
    const nodeMap = new Map<string, GraphNodeRuntime>();
    for (const n of nodes) {
      nodeMap.set(n.id, { ...n, val: 1, neighbors: [], links: [] });
    }
    const links: GraphLinkRuntime[] = [];
    for (const e of edges) {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t || s === t) continue;
      const link: GraphLinkRuntime = { source: e.source, target: e.target };
      links.push(link);
      s.neighbors.push(t);
      t.neighbors.push(s);
      s.links.push(link);
      t.links.push(link);
      s.val += 1;
      t.val += 1;
    }
    return { nodes: Array.from(nodeMap.values()), links };
  }, [nodes, edges]);

  const filtered = useMemo(() => {
    const keepNodes = data.nodes.filter((n) => activeKinds.has(n.kind));
    const keepIds = new Set(keepNodes.map((n) => n.id));
    const keepLinks = data.links.filter((l) => {
      const sId = typeof l.source === "string" ? l.source : l.source.id;
      const tId = typeof l.target === "string" ? l.target : l.target.id;
      return keepIds.has(sId) && keepIds.has(tId);
    });
    return { nodes: keepNodes, links: keepLinks };
  }, [data, activeKinds]);

  const highlight = useMemo(() => {
    if (!hoverId) return null;
    const node = data.nodes.find((n) => n.id === hoverId);
    if (!node) return null;
    const ids = new Set<string>([node.id]);
    for (const nb of node.neighbors) ids.add(nb.id);
    return ids;
  }, [hoverId, data.nodes]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleNodeClick = useCallback(
    (node: { id?: string | number }) => {
      if (typeof node.id !== "string") return;
      const path = node.id.replace(/\.md$/, "");
      router.push(`/admin/vault/${path}`);
    },
    [router]
  );

  const handleNodeDragEnd = useCallback((node: GraphNodeRuntime) => {
    if (node.x != null) node.fx = node.x;
    if (node.y != null) node.fy = node.y;
  }, []);

  const handleNodeHover = useCallback((node: GraphNodeRuntime | null) => {
    hoverNodeRef.current = node;
    setHoverId(node?.id ?? null);
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? "pointer" : "grab";
    }
    if (tooltipRef.current && !node) {
      tooltipRef.current.style.opacity = "0";
    }
  }, []);

  const hoverNodeData = useMemo(
    () => (hoverId ? data.nodes.find((n) => n.id === hoverId) ?? null : null),
    [hoverId, data.nodes]
  );

  const toggleKind = useCallback((kind: string) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const fg = fgRef.current;
    if (!fg) return;
    const current = fg.zoom();
    fg.zoom(current * factor, 250);
  }, []);

  const recenter = useCallback(() => {
    fgRef.current?.zoomToFit(400, 60);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-lg"
      style={{ cursor: "grab" }}
    >
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,#FFFFFF_0%,#F5F7F8_75%)]" />

      <div className="absolute right-4 top-4 z-10 flex flex-col gap-0.5 rounded-md border border-border bg-white/90 p-2 shadow-sm backdrop-blur">
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Catégories
        </p>
        {Object.entries(KIND_STYLE).map(([kind, style]) => {
          const active = activeKinds.has(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              className={`flex items-center gap-2 rounded px-2 py-1 text-xs transition hover:bg-light ${
                active ? "text-foreground" : "text-muted-foreground/50"
              }`}
            >
              <span
                className="size-2.5 rounded-full ring-1 ring-black/5"
                style={{ background: active ? style.color : "transparent", borderColor: style.color }}
              />
              <span>{style.label}</span>
            </button>
          );
        })}
      </div>

      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1 rounded-md border border-border bg-white/90 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => zoomBy(1.4)}
          className="flex size-8 items-center justify-center rounded hover:bg-light"
          aria-label="Zoom avant"
        >
          <Plus className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.4)}
          className="flex size-8 items-center justify-center rounded hover:bg-light"
          aria-label="Zoom arrière"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={recenter}
          className="flex size-8 items-center justify-center rounded hover:bg-light"
          aria-label="Recentrer"
        >
          <Maximize2 className="size-4" aria-hidden />
        </button>
      </div>

      <div
        ref={tooltipRef}
        className="pointer-events-none absolute left-0 top-0 z-20 max-w-[220px] rounded-md border border-border bg-white/95 px-2.5 py-1.5 text-xs shadow-md backdrop-blur transition-opacity duration-100"
        style={{ opacity: 0, willChange: "transform" }}
      >
        {hoverNodeData && (
          <>
            <div className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full ring-1 ring-black/5"
                style={{ background: KIND_STYLE[hoverNodeData.kind]?.color ?? FALLBACK_COLOR }}
              />
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {KIND_STYLE[hoverNodeData.kind]?.label ?? hoverNodeData.kind}
              </span>
            </div>
            <div className="mt-0.5 truncate font-medium text-foreground">
              {hoverNodeData.title}
            </div>
          </>
        )}
      </div>

      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D
          ref={fgRef as never}
          graphData={filtered}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={120}
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.32}
          warmupTicks={20}
          nodeRelSize={4}
          enableNodeDrag
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover as never}
          onNodeDragEnd={handleNodeDragEnd as never}
          onRenderFramePost={() => {
            const tip = tooltipRef.current;
            const fg = fgRef.current;
            const n = hoverNodeRef.current;
            if (!tip || !fg) return;
            if (!n || n.x == null || n.y == null) {
              if (tip.style.opacity !== "0") tip.style.opacity = "0";
              return;
            }
            const screen = fg.graph2ScreenCoords(n.x, n.y);
            const radius = nodeRadius(n) * fg.zoom();
            tip.style.transform = `translate3d(calc(${screen.x}px - 50%), calc(${screen.y - radius - 12}px - 100%), 0)`;
            if (tip.style.opacity !== "1") tip.style.opacity = "1";
          }}
          linkColor={(link) => {
            if (!highlight) return "rgba(107, 114, 128, 0.28)";
            const sId =
              typeof (link as GraphLinkRuntime).source === "string"
                ? ((link as GraphLinkRuntime).source as string)
                : ((link as GraphLinkRuntime).source as GraphNodeRuntime).id;
            const tId =
              typeof (link as GraphLinkRuntime).target === "string"
                ? ((link as GraphLinkRuntime).target as string)
                : ((link as GraphLinkRuntime).target as GraphNodeRuntime).id;
            return highlight.has(sId) && highlight.has(tId)
              ? "rgba(204, 6, 65, 0.85)"
              : "rgba(107, 114, 128, 0.08)";
          }}
          linkWidth={(link) => {
            if (!highlight) return 0.7;
            const sId =
              typeof (link as GraphLinkRuntime).source === "string"
                ? ((link as GraphLinkRuntime).source as string)
                : ((link as GraphLinkRuntime).source as GraphNodeRuntime).id;
            const tId =
              typeof (link as GraphLinkRuntime).target === "string"
                ? ((link as GraphLinkRuntime).target as string)
                : ((link as GraphLinkRuntime).target as GraphNodeRuntime).id;
            return highlight.has(sId) && highlight.has(tId) ? 1.6 : 0.4;
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            const n = node as GraphNodeRuntime;
            if (n.x == null || n.y == null) return;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.x, n.y, nodeRadius(n) + 3, 0, 2 * Math.PI);
            ctx.fill();
          }}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as GraphNodeRuntime;
            if (n.x == null || n.y == null) return;
            const r = nodeRadius(n);
            const isHover = hoverId === n.id;
            const dimmed = highlight ? !highlight.has(n.id) : false;
            const baseColor = KIND_STYLE[n.kind]?.color ?? FALLBACK_COLOR;

            ctx.globalAlpha = dimmed ? 0.18 : 1;

            if (isHover) {
              const glow = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r + 10);
              glow.addColorStop(0, baseColor + "55");
              glow.addColorStop(1, baseColor + "00");
              ctx.fillStyle = glow;
              ctx.beginPath();
              ctx.arc(n.x, n.y, r + 10, 0, 2 * Math.PI);
              ctx.fill();
            }

            const sphere = ctx.createRadialGradient(
              n.x - r * 0.35,
              n.y - r * 0.35,
              r * 0.1,
              n.x,
              n.y,
              r
            );
            sphere.addColorStop(0, "#FFFFFF");
            sphere.addColorStop(0.25, baseColor);
            sphere.addColorStop(1, baseColor);
            ctx.fillStyle = sphere;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
            ctx.fill();

            ctx.lineWidth = 1 / globalScale;
            ctx.strokeStyle = "rgba(255,255,255,0.85)";
            ctx.stroke();

            const showLabel = !dimmed && globalScale > 2.6 && !isHover;
            if (showLabel) {
              const rawLabel = n.title ?? "";
              const label = rawLabel.length > 28 ? rawLabel.slice(0, 27) + "…" : rawLabel;
              const fontSize = 11 / globalScale;
              ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
              const padX = 5 / globalScale;
              const padY = 3 / globalScale;
              const textWidth = ctx.measureText(label).width;
              const boxX = n.x - textWidth / 2 - padX;
              const boxY = n.y + r + 4 / globalScale;
              const boxW = textWidth + padX * 2;
              const boxH = fontSize + padY * 2;

              ctx.fillStyle = "rgba(255,255,255,0.92)";
              ctx.strokeStyle = "rgba(0,0,0,0.06)";
              ctx.lineWidth = 0.5 / globalScale;
              const radius = 3 / globalScale;
              ctx.beginPath();
              ctx.moveTo(boxX + radius, boxY);
              ctx.lineTo(boxX + boxW - radius, boxY);
              ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
              ctx.lineTo(boxX + boxW, boxY + boxH - radius);
              ctx.quadraticCurveTo(
                boxX + boxW,
                boxY + boxH,
                boxX + boxW - radius,
                boxY + boxH
              );
              ctx.lineTo(boxX + radius, boxY + boxH);
              ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
              ctx.lineTo(boxX, boxY + radius);
              ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = "#1A1A1A";
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillText(label, n.x, boxY + padY);
            }

            ctx.globalAlpha = 1;
          }}
        />
      )}
    </div>
  );
}
