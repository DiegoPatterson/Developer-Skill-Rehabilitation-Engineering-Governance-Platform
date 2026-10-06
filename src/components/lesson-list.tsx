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
import { pathForLesson } from "@/content/paths";
import type { GraphNodeView, GraphStatus, RetiredLesson } from "@/content/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function requirementLabel(node: GraphNodeView, byId: Map<string, GraphNodeView>): string {
  if (node.status !== "locked") return "";
  return formatRequirement(node.prereqs.map((id) => byId.get(id)?.number).filter((number): number is number => number != null));
}

function openNode(router: ReturnType<typeof useRouter>, href: string, status: GraphStatus) {
  if (status === "locked") return;
  router.push(href);
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

export function LessonList({
  nodes,
  staff = false,
  retired = [],
}: {
  nodes: GraphNodeView[];
  staff?: boolean;
  retired?: RetiredLesson[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sort, setSort] = useState<LessonSort>("number");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const listed = useMemo(() => {
    const filter = { query, category, difficulty: difficulty === "" ? null : Number(difficulty) };
    return nodes.filter((node) => lessonVisible(node, filter)).sort(compareLessons(sort));
  }, [nodes, query, category, difficulty, sort]);
  const countLabel = query || category || difficulty ? `${listed.length} of ${nodes.length}` : `${nodes.length} lessons`;

  async function changeLesson(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setNotice("");
    try {
      await patchCatalog(id, body);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the lesson.");
    } finally {
      setBusy("");
    }
  }

  function retire(node: { id: string; title: string }) {
    if (!window.confirm(`Retire "${node.title}"? It leaves Lessons and its path. You can restore it from this page.`)) return;
    void changeLesson(node.id, { active: false });
  }

  return (
    <div className="skill-board">
      <div className="flex flex-col gap-3 border-b border-[#27272A] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="field min-w-0 flex-1 basis-56"
            type="search"
            value={query}
            placeholder="Search title, category, or #number"
            aria-label="Search lessons"
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="font-mono text-xs text-zinc-500">{countLabel}</p>
          <Link href="/learn" className="text-sm text-[#4ADE80]">
            Learning paths
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field w-auto" aria-label="Lesson type" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All types</option>
            {LESSON_TYPES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select className="field w-auto" aria-label="Difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="">Any difficulty</option>
            {["1", "2", "3", "4", "5"].map((level) => (
              <option key={level} value={level}>
                Difficulty {level}
              </option>
            ))}
          </select>
          <select className="field w-auto" aria-label="Sort list" value={sort} onChange={(event) => setSort(event.target.value as LessonSort)}>
            <option value="number">Sort by number</option>
            <option value="title">Sort by title</option>
            <option value="difficulty">Easiest first</option>
            <option value="difficulty-desc">Hardest first</option>
            <option value="category">Sort by type</option>
          </select>
        </div>
      </div>
      {notice ? <p className="px-4 py-2 text-sm text-red-300">{notice}</p> : null}
      {staff && retired.length > 0 ? (
        <ul className="flex max-h-36 flex-col gap-2 overflow-auto border-b border-[#27272A] px-4 py-2 text-xs text-zinc-400">
          {retired.map((node) => (
            <li key={node.id} className="flex flex-wrap items-center gap-2">
              <span>
                {node.number > 0 ? formatLessonNumber(node.number) : "Retired"} {node.title}
              </span>
              <span>{lessonTypeLabel(node.category)}</span>
              <button className="btn" type="button" disabled={busy === node.id} onClick={() => void changeLesson(node.id, { active: true })}>
                Restore
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4">
          <p className="text-xs text-zinc-500">Every active lesson is here. A lesson stays locked until every lesson it requires is mastered.</p>
          {listed.length === 0 ? <p className="text-sm text-zinc-400">No lessons match.</p> : null}
          {listed.map((node) => {
            const locked = node.status === "locked";
            const mastered = node.status === "mastered";
            const requirement = requirementLabel(node, byId);
            const path = pathForLesson(node.number);
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
                  {path ? <div className="mt-1 text-[10px] text-zinc-500">{path.title} path</div> : null}
                </button>
                {staff ? (
                  <div className="mt-2">
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
    </div>
  );
}
