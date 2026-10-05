"use client";

import type { GraphNodeView, GraphStatus } from "@/content/view-model";
import {
  Background,
  Controls,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

type SkillData = {
  title: string;
  category: string;
  difficulty: number;
  status: GraphStatus;
  summary: string;
};
type SkillFlowNode = Node<SkillData, "skill">;

function SkillCard({ data }: NodeProps<SkillFlowNode>) {
  const locked = data.status === "locked";
  const mastered = data.status === "mastered";
  return (
    <div
      className="w-[220px] rounded-lg border px-3 py-2"
      style={{
        background: mastered ? "#052e16" : "#121215",
        borderColor: locked ? "#3f3f46" : "#10B981",
        boxShadow: data.status === "in_progress" ? "0 0 0 1px #10B981, 0 0 18px rgba(16,185,129,0.35)" : "none",
        opacity: locked ? 0.55 : 1,
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{data.category}</div>
      <div className="mt-1 text-sm font-medium text-zinc-100">{data.title}</div>
      <div className="mt-1 text-xs text-zinc-500">Difficulty {data.difficulty}</div>
      <div className="mt-2 text-xs text-[#4ADE80]">{mastered ? "Mastered" : locked ? "Locked" : "Open"}</div>
    </div>
  );
}

const nodeTypes = { skill: SkillCard };

export function SkillGraph({ nodes }: { nodes: GraphNodeView[] }) {
  const router = useRouter();
  const flowNodes = useMemo<SkillFlowNode[]>(
    () =>
      nodes.map((node) => ({
        id: node.id,
        type: "skill",
        position: { x: node.x, y: node.y },
        data: {
          title: node.title,
          category: node.category,
          difficulty: node.difficulty,
          status: node.status,
          summary: node.summary,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      })),
    [nodes],
  );
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const edges = useMemo<Edge[]>(
    () =>
      nodes.flatMap((node) =>
        node.prereqs
          .filter((prereq) => byId.has(prereq))
          .map((prereq) => ({
            id: `${prereq}-${node.id}`,
            source: prereq,
            target: node.id,
            type: "smoothstep",
            style: { stroke: byId.get(prereq)?.status === "mastered" ? "#10B981" : "#3f3f46" },
          })),
      ),
    [nodes, byId],
  );

  return (
    <div className="skill-graph">
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          const status = (node.data as SkillData).status;
          if (status === "locked") return;
          router.push(`/challenge/${node.id}`);
        }}
      >
        <Background color="#27272A" gap={20} />
        <Controls showInteractive={false} />
        <Panel position="top-left">
          <p className="rounded-md border border-[#27272A] bg-[#121215] px-3 py-2 text-xs text-zinc-400">
            Open a lit node. Locked nodes wait until every prerequisite is mastered.
          </p>
        </Panel>
      </ReactFlow>
    </div>
  );
}
