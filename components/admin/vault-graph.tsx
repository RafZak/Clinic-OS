"use client";

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type VaultNode = {
  id: string;
  slug: string;
  title: string;
  kind: string;
};

const KIND_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  practitioner: { bg: "bg-brand/10", text: "text-brand", border: "border-brand/40" },
  assistant: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-400" },
  center: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-400" },
  patient: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-400" },
  pattern: { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-400" },
  session: { bg: "bg-violet-100", text: "text-violet-800", border: "border-violet-400" },
  index: { bg: "bg-slate-100", text: "text-slate-800", border: "border-slate-400" },
};

function VaultNodeBox({ data }: NodeProps<Node<{ slug: string; title: string; kind: string }>>) {
  const colors = KIND_COLOR[data.kind] ?? KIND_COLOR.index;
  return (
    <div
      className={`rounded-md border ${colors.bg} ${colors.text} ${colors.border} px-3 py-2 shadow-sm`}
      style={{ minWidth: 140, maxWidth: 200 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />
      <p className="text-[9px] uppercase tracking-wide opacity-70">{data.kind}</p>
      <p className="truncate text-xs font-medium">{data.title}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />
    </div>
  );
}

const NODE_TYPES = { vault: VaultNodeBox };

export function VaultGraph({
  nodes,
  edges,
}: {
  nodes: VaultNode[];
  edges: { source: string; target: string }[];
}) {
  const router = useRouter();

  const flowNodes: Node[] = useMemo(() => {
    // Layout simple : grid groupé par kind (colonnes), espacement vertical par
    // ordre d'arrivée. Pas de force-directed, pas de dépendance lourde.
    const byKind = new Map<string, VaultNode[]>();
    for (const n of nodes) {
      const arr = byKind.get(n.kind) ?? [];
      arr.push(n);
      byKind.set(n.kind, arr);
    }
    const KIND_ORDER = [
      "index",
      "center",
      "practitioner",
      "assistant",
      "patient",
      "pattern",
      "session",
    ];
    const kinds = KIND_ORDER.filter((k) => byKind.has(k)).concat(
      Array.from(byKind.keys()).filter((k) => !KIND_ORDER.includes(k))
    );

    const result: Node[] = [];
    let xOffset = 0;
    for (const kind of kinds) {
      const arr = byKind.get(kind) ?? [];
      arr.forEach((n, i) => {
        result.push({
          id: n.id,
          type: "vault",
          position: { x: xOffset, y: i * 90 },
          data: { slug: n.slug, title: n.title, kind: n.kind },
        });
      });
      xOffset += 240;
    }
    return result;
  }, [nodes]);

  const flowEdges: Edge[] = useMemo(
    () =>
      edges.map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        animated: false,
        style: { stroke: "#CC0641", strokeWidth: 1.2, opacity: 0.4 },
      })),
    [edges]
  );

  const onNodeClick = useCallback(
    (_evt: unknown, node: Node) => {
      const path = node.id.replace(/\.md$/, "");
      router.push(`/admin/vault/${path}`);
    },
    [router]
  );

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={NODE_TYPES}
      onNodeClick={onNodeClick}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} size={1} color="#E5E7EB" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
