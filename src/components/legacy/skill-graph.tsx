"use client";

import {
  LESSON_TYPES,
  compareLessons,
  formatLessonNumber,
  formatRequirement,
  lessonTypeLabel,
  lessonVisible,
  type LessonSort,
} from "@/content/lesson";
import type { GraphNodeView, GraphStatus, RetiredLesson } from "@/content/view-model";
import { SKILL_CARD, layoutSkillGraph } from "@/engine/graph-layout";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

type SkillData = {
  number: number;
  title: string;
  category: string;
  difficulty: number;
  status: GraphStatus;
  summary: string;
  label: string;
  dimmed: boolean;
  requirement: string;
};
type SkillFlowNode = Node<SkillData, "skill">;
type GraphMode = "tree" | "list";

const NARROW = "(max-width: 720px)";
const VIEW_KEY = "sg-graph-view";
const TRACK_KEY = "sg-graph-track";
const TRACK_IDS = new Set<string>(LESSON_TYPES.map(([id]) => id));

function useNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(NARROW);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

function readSavedMode(): GraphMode | null {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === "tree" || saved === "list" ? saved : null;
  } catch {
    return null;
  }
}

function useGraphMode(narrow: boolean): [GraphMode, (mode: GraphMode) => void] {
  const saved = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("sg-graph-view", onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener("sg-graph-view", onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    readSavedMode,
    () => null,
  );
  const choose = (mode: GraphMode) => {
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      return;
    }
    window.dispatchEvent(new Event("sg-graph-view"));
  };
  return [saved ?? (narrow ? "list" : "tree"), choose];
}

function readSavedTrack(): string | null {
  try {
    const saved = localStorage.getItem(TRACK_KEY);
    return saved && TRACK_IDS.has(saved) ? saved : null;
  } catch {
    return null;
  }
}

function useGraphTrack(): [string, (track: string) => void] {
  const saved = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("sg-graph-track", onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener("sg-graph-track", onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    readSavedTrack,
    () => null,
  );
  const choose = (track: string) => {
    if (!TRACK_IDS.has(track)) return;
    try {
      localStorage.setItem(TRACK_KEY, track);
    } catch {
      return;
    }
    window.dispatchEvent(new Event("sg-graph-track"));
  };
  return [saved ?? "debugging", choose];
}

function SkillCard({ data }: NodeProps<SkillFlowNode>) {
  const locked = data.status === "locked";
  const mastered = data.status === "mastered";
  return (
    <div className="relative h-full w-full">
      <Handle type="target" position={Position.Left} isConnectable={false} style={{ background: "#3f3f46", border: "none", width: 8, height: 8, pointerEvents: "none" }} />
      <Handle type="source" position={Position.Right} isConnectable={false} style={{ background: "#10B981", border: "none", width: 8, height: 8, pointerEvents: "none" }} />
      <div
        className="h-full w-full overflow-hidden rounded-lg border px-3 py-2"
        style={{
          background: mastered ? "#052e16" : "#121215",
          borderColor: data.dimmed ? "#27272A" : locked ? "#3f3f46" : "#10B981",
          boxShadow: !data.dimmed && data.status === "in_progress" ? "0 0 0 1px #10B981, 0 0 18px rgba(16,185,129,0.35)" : "none",
          opacity: data.dimmed ? 0.2 : locked ? 0.55 : 1,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="truncate font-mono text-[10px] uppercase tracking-wide text-zinc-500">
            {data.category}
            {data.label ? ` · ${data.label}` : ""}
          </div>
          <div className="font-mono text-[10px] text-zinc-300">{formatLessonNumber(data.number)}</div>
        </div>
        <div className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-zinc-100">{data.title}</div>
        <div className="mt-1 text-xs text-zinc-500">Difficulty {data.difficulty}</div>
        <div className="mt-2 text-xs text-[#4ADE80]">{mastered ? "Mastered" : locked ? "Locked" : "Open"}</div>
        {data.requirement ? <div className="mt-1 truncate text-[10px] text-zinc-400">{data.requirement}</div> : null}
      </div>
    </div>
  );
}

const nodeTypes = { skill: SkillCard };

function FitOnResize() {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const fit = () => void fitView({ padding: 0.18, duration: 0 });
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fitView]);
  return null;
}

function requirementLabel(node: GraphNodeView, byId: Map<string, GraphNodeView>): string {
  if (node.status !== "locked") return "";
  return formatRequirement(node.prereqs.map((id) => byId.get(id)?.number).filter((number): number is number => number != null));
}

function openNode(router: ReturnType<typeof useRouter>, href: string, status: GraphStatus) {
  if (status === "locked") return;
  router.push(href);
}

function TrackSearchHits({
  elsewhere,
  outside,
  onTrack,
}: {
  elsewhere: GraphNodeView[];
  outside: GraphNodeView[];
  onTrack: (category: string) => void;
}) {
  if (elsewhere.length === 0 && outside.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-b border-[#27272A] px-4 py-2 text-xs text-zinc-400">
      {elsewhere.map((node) => (
        <button key={node.id} type="button" className="w-fit text-left text-[#4ADE80]" onClick={() => onTrack(node.category)}>
          {formatLessonNumber(node.number)} {node.title} is on {lessonTypeLabel(node.category)}
        </button>
      ))}
      {outside.map((node) => (
        <Link key={node.id} href={node.href} className="w-fit text-[#4ADE80]">
          {formatLessonNumber(node.number)} {node.title} is outside the trees
        </Link>
      ))}
    </div>
  );
}

function LessonBar({
  query,
  onQuery,
  category,
  onCategory,
  difficulty,
  onDifficulty,
  sort,
  onSort,
  mode,
  onMode,
  track,
  onTrack,
  countLabel,
}: {
  query: string;
  onQuery: (value: string) => void;
  category: string;
  onCategory: (value: string) => void;
  difficulty: string;
  onDifficulty: (value: string) => void;
  sort: LessonSort;
  onSort: (value: LessonSort) => void;
  mode: GraphMode;
  onMode: (mode: GraphMode) => void;
  track: string;
  onTrack: (track: string) => void;
  countLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#27272A] px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="field min-w-0 flex-1 basis-56"
          type="search"
          value={query}
          placeholder="Search title, category, or #number"
          aria-label="Search lessons"
          onChange={(event) => onQuery(event.target.value)}
        />
        <div className="flex gap-2">
          <button className={`btn ${mode === "tree" ? "btn-primary" : ""}`} type="button" aria-pressed={mode === "tree"} onClick={() => onMode("tree")}>
            Tree
          </button>
          <button className={`btn ${mode === "list" ? "btn-primary" : ""}`} type="button" aria-pressed={mode === "list"} onClick={() => onMode("list")}>
            List
          </button>
        </div>
        <p className="font-mono text-xs text-zinc-500">{countLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {mode === "tree" ? (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Skill trees">
            {LESSON_TYPES.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={track === id}
                className={`btn ${track === id ? "btn-primary" : ""}`}
                onClick={() => onTrack(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <select className="field w-auto" aria-label="Lesson type" value={category} onChange={(event) => onCategory(event.target.value)}>
            <option value="">All types</option>
            {LESSON_TYPES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        )}
        <select className="field w-auto" aria-label="Difficulty" value={difficulty} onChange={(event) => onDifficulty(event.target.value)}>
          <option value="">Any difficulty</option>
          {["1", "2", "3", "4", "5"].map((level) => (
            <option key={level} value={level}>
              Difficulty {level}
            </option>
          ))}
        </select>
        {mode === "list" ? (
          <select
            className="field w-auto"
            aria-label="Sort list"
            value={sort}
            onChange={(event) => onSort(event.target.value as LessonSort)}
          >
            <option value="number">Sort by number</option>
            <option value="title">Sort by title</option>
            <option value="difficulty">Easiest first</option>
            <option value="difficulty-desc">Hardest first</option>
            <option value="category">Sort by type</option>
          </select>
        ) : null}
      </div>
    </div>
  );
}

async function patchCatalog(id: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`/api/catalog/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error ?? "Could not update the lesson.");
}

function CatalogShelf({
  mode,
  offTree,
  retired,
  busy,
  notice,
  onAdd,
  onRetire,
  onRestore,
}: {
  mode: GraphMode;
  offTree: GraphNodeView[];
  retired: RetiredLesson[];
  busy: string;
  notice: string;
  onAdd: (id: string, category: string) => void;
  onRetire: (node: { id: string; title: string }) => void;
  onRestore: (id: string) => void;
}) {
  const showOff = mode === "tree" && offTree.length > 0;
  if (mode !== "tree" && retired.length === 0 && !notice) return null;
  return (
    <div className="max-h-44 overflow-auto border-b border-zinc-800 px-4 py-2 text-xs text-zinc-400">
      {mode === "tree" ? <p>Drag a card to save where it sits. Lessons that are not on a tree stay in the list.</p> : null}
      {notice ? <p className="mt-1 text-sm text-red-300">{notice}</p> : null}
      {showOff ? (
        <ul className="mt-2 flex flex-col gap-2">
          {offTree.map((node) => (
            <li key={node.id} className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-200">
                {formatLessonNumber(node.number)} {node.title}
              </span>
              <span className="text-zinc-500">{lessonTypeLabel(node.category)} · not on the tree</span>
              <button className="btn" type="button" disabled={busy === node.id} onClick={() => onAdd(node.id, node.category)}>
                Add to tree
              </button>
              <button className="btn" type="button" disabled={busy === node.id} onClick={() => onRetire(node)}>
                Retire
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {retired.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {retired.map((node) => (
            <li key={node.id} className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500">
                {node.number > 0 ? formatLessonNumber(node.number) : "Retired"} {node.title}
              </span>
              <span>Retired</span>
              <button className="btn" type="button" disabled={busy === node.id} onClick={() => onRestore(node.id)}>
                Restore
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SkillGraph({
  nodes,
  staff = false,
  retired = [],
}: {
  nodes: GraphNodeView[];
  staff?: boolean;
  retired?: RetiredLesson[];
}) {
  const router = useRouter();
  const narrow = useNarrow();
  const [mode, setMode] = useGraphMode(narrow);
  const [track, setTrack] = useGraphTrack();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sort, setSort] = useState<LessonSort>("number");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [savedPos, setSavedPos] = useState<Record<string, { x: number; y: number }>>({});
  const treeNodes = useMemo(() => nodes.filter((node) => node.inGraph), [nodes]);
  const onTrack = useMemo(() => treeNodes.filter((node) => node.category === track), [treeNodes, track]);
  const placed = useMemo(
    () =>
      layoutSkillGraph(
        onTrack
          .filter((node) => !node.placed)
          .map((node) => ({ id: node.id, prereqs: node.prereqs, category: node.category, number: node.number })),
      ),
    [onTrack],
  );
  const narrowed = query.trim().length > 0 || category !== "" || difficulty !== "";
  const treeNarrowed = query.trim().length > 0 || difficulty !== "";
  const treeFilter = useMemo(
    () => ({ query, category: "", difficulty: difficulty === "" ? null : Number(difficulty) }),
    [query, difficulty],
  );
  const matches = useMemo(() => {
    const ids = new Set<string>();
    const filter = { query, category, difficulty: difficulty === "" ? null : Number(difficulty) };
    for (const node of nodes) {
      if (lessonVisible(node, filter)) ids.add(node.id);
    }
    return ids;
  }, [nodes, query, category, difficulty]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const derivedNodes = useMemo<SkillFlowNode[]>(
    () =>
      onTrack.map((node) => ({
        id: node.id,
        type: "skill",
        position: savedPos[node.id] ?? (node.placed ? { x: node.x, y: node.y } : (placed.positions.get(node.id) ?? { x: 0, y: 0 })),
        width: SKILL_CARD.width,
        height: SKILL_CARD.height,
        style: { width: SKILL_CARD.width, height: SKILL_CARD.height },
        data: {
          number: node.number,
          title: node.title,
          category: node.category,
          difficulty: node.difficulty,
          status: node.status,
          summary: node.summary,
          label: node.label,
          dimmed: treeNarrowed && !lessonVisible(node, treeFilter),
          requirement: requirementLabel(node, byId),
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      })),
    [onTrack, placed, treeNarrowed, treeFilter, byId, savedPos],
  );
  const flowSignature = derivedNodes
    .map((node) => [node.id, node.position.x, node.position.y, node.data.status, node.data.dimmed, node.data.requirement, node.data.title].join(":"))
    .join("|");
  const [flowNodes, setFlowNodes] = useState(derivedNodes);
  const [seenFlow, setSeenFlow] = useState(flowSignature);
  if (flowSignature !== seenFlow) {
    setSeenFlow(flowSignature);
    setFlowNodes(derivedNodes);
  }
  const offTree = useMemo(() => nodes.filter((node) => !node.inGraph).sort((a, b) => a.number - b.number), [nodes]);
  async function changeLesson(id: string, body: Record<string, unknown>, trackTo?: string) {
    setBusy(id);
    setNotice("");
    setSavedPos((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    try {
      await patchCatalog(id, body);
      if (trackTo) setTrack(trackTo);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the lesson.");
    } finally {
      setBusy("");
    }
  }
  function retire(node: { id: string; title: string }) {
    if (!window.confirm(`Retire "${node.title}"? It leaves the list and the tree. You can restore it from this page.`)) return;
    void changeLesson(node.id, { active: false });
  }
  const edges = useMemo<Edge[]>(
    () =>
      onTrack.flatMap((node) =>
        node.prereqs
          .filter((prereq) => onTrack.some((item) => item.id === prereq))
          .map((prereq) => {
            const quiet = treeNarrowed && (!lessonVisible(node, treeFilter) || !lessonVisible(byId.get(prereq) ?? node, treeFilter));
            return {
              id: `${prereq}-${node.id}`,
              source: prereq,
              target: node.id,
              type: "smoothstep",
              style: {
                stroke: !quiet && byId.get(prereq)?.status === "mastered" ? "#10B981" : "#3f3f46",
                opacity: quiet ? 0.15 : 1,
              },
            };
          }),
      ),
    [onTrack, byId, treeNarrowed, treeFilter],
  );
  const queryActive = query.trim().length > 0;
  const elsewhere = useMemo(
    () =>
      queryActive
        ? nodes
            .filter((node) => node.inGraph && node.category !== track && lessonVisible(node, treeFilter))
            .sort((a, b) => a.number - b.number)
        : [],
    [nodes, track, queryActive, treeFilter],
  );
  const outside = useMemo(
    () => (queryActive ? nodes.filter((node) => !node.inGraph && lessonVisible(node, treeFilter)) : []),
    [nodes, queryActive, treeFilter],
  );
  const trackMatches = onTrack.filter((node) => lessonVisible(node, treeFilter)).length;
  const countLabel =
    mode === "tree"
      ? treeNarrowed
        ? `${trackMatches} of ${onTrack.length}`
        : `${onTrack.length} in this tree`
      : narrowed
        ? `${matches.size} of ${nodes.length}`
        : `${nodes.length} lessons`;
  const listed = useMemo(() => {
    return [...nodes].filter((node) => matches.has(node.id)).sort(compareLessons(sort));
  }, [nodes, matches, sort]);

  return (
    <div className="skill-board">
      <LessonBar
        query={query}
        onQuery={setQuery}
        category={category}
        onCategory={setCategory}
        difficulty={difficulty}
        onDifficulty={setDifficulty}
        sort={sort}
        onSort={setSort}
        mode={mode}
        onMode={setMode}
        track={track}
        onTrack={setTrack}
        countLabel={countLabel}
      />
      {staff ? (
        <CatalogShelf
          mode={mode}
          offTree={offTree}
          retired={retired}
          busy={busy}
          notice={notice}
          onAdd={(id, category) => void changeLesson(id, { showInGraph: true }, category)}
          onRetire={retire}
          onRestore={(id) => void changeLesson(id, { active: true })}
        />
      ) : notice ? (
        <p className="px-4 py-2 text-sm text-red-300">{notice}</p>
      ) : null}
      {mode === "list" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4">
            <p className="text-xs text-zinc-500">Each track starts open. A lesson with more than one requirement stays locked until every one of them is mastered.</p>
            {listed.length === 0 ? <p className="text-sm text-zinc-400">No lessons match.</p> : null}
            {listed.map((node) => {
              const locked = node.status === "locked";
              const mastered = node.status === "mastered";
              const requirement = requirementLabel(node, byId);
              return (
                <div
                  key={node.id}
                  className="w-full rounded-lg border px-3 py-3 text-left"
                  style={{
                    background: mastered ? "#052e16" : "#121215",
                    borderColor: locked ? "#3f3f46" : "#10B981",
                    opacity: locked ? 0.55 : 1,
                  }}
                >
                  <button type="button" disabled={locked} onClick={() => openNode(router, node.href, node.status)} className="w-full text-left">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                        {node.category}
                        {node.label ? ` · ${node.label}` : ""}
                      </div>
                      <div className="font-mono text-xs text-zinc-300">{formatLessonNumber(node.number)}</div>
                    </div>
                    <div className="mt-1 text-sm font-medium text-zinc-100">{node.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">Difficulty {node.difficulty}</div>
                    <div className="mt-2 text-xs text-[#4ADE80]">{mastered ? "Mastered" : locked ? "Locked" : "Open"}</div>
                    {requirement ? <div className="mt-1 text-xs text-zinc-400">{requirement}</div> : null}
                    {node.inGraph ? null : <div className="mt-1 text-[10px] text-zinc-500">Not on the tree</div>}
                  </button>
                  {staff ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {node.inGraph ? (
                        <button className="btn" type="button" disabled={busy === node.id} onClick={() => void changeLesson(node.id, { showInGraph: false })}>
                          Take off tree
                        </button>
                      ) : (
                        <button className="btn" type="button" disabled={busy === node.id} onClick={() => void changeLesson(node.id, { showInGraph: true }, node.category)}>
                          Add to tree
                        </button>
                      )}
                      <button className="btn" type="button" disabled={busy === node.id} onClick={() => retire(node)}>
                        Retire
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <TrackSearchHits elsewhere={elsewhere} outside={outside} onTrack={setTrack} />
          <div className="skill-graph">
          <ReactFlow
            key={track}
            nodes={flowNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.15}
            nodesDraggable={staff}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
            onNodesChange={(changes) => setFlowNodes((current) => applyNodeChanges(changes, current))}
            onNodeDragStop={(_, node) => {
              if (!staff) return;
              const position = { x: node.position.x, y: node.position.y };
              setSavedPos((current) => ({ ...current, [node.id]: position }));
              void patchCatalog(node.id, { positionX: position.x, positionY: position.y }).catch((error: unknown) => {
                setSavedPos((current) => {
                  const next = { ...current };
                  delete next[node.id];
                  return next;
                });
                setNotice(error instanceof Error ? error.message : "Could not save the position.");
              });
            }}
            onNodeClick={(_, node) => openNode(router, byId.get(node.id)?.href ?? `/challenge/${node.id}`, (node.data as SkillData).status)}
          >
            <Background color="#27272A" gap={20} />
            <Controls showInteractive={false} />
            <FitOnResize />
          </ReactFlow>
          </div>
        </>
      )}
    </div>
  );
}
