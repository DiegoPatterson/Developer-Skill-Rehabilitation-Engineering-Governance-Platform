"use client";

import type { CfgView } from "@/content/view-model";
import { Background, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";

export function CfgViewPanel({ cfg }: { cfg: CfgView }) {
  const nodes = useMemo<Node[]>(
    () =>
      cfg.nodes.map((node, index) => ({
        id: node.id,
        position: { x: node.unreachable ? 280 : 20, y: index * 68 },
        data: { label: node.label },
        style: {
          background: node.unreachable ? "#27272A" : "#121215",
          color: node.unreachable ? "#a1a1aa" : "#e4e4e7",
          border: `1px solid ${node.kind === "condition" ? "#4ADE80" : "#27272A"}`,
          fontSize: 11,
          width: 220,
        },
      })),
    [cfg.nodes],
  );
  const edges = useMemo<Edge[]>(
    () =>
      cfg.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: "smoothstep",
        style: { stroke: "#52525b" },
      })),
    [cfg.edges],
  );
  return (
    <div className="h-72 rounded-md border border-[#27272A]">
      <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
        <Background color="#27272A" gap={16} />
      </ReactFlow>
    </div>
  );
}
