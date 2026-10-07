"use client";

import { LESSON_TYPES, compareLessons, formatLessonNumber, lessonTypeLabel, lessonVisible, type LessonSort } from "@/content/lesson";
import { pathTopics } from "@/content/paths";
import type { GraphNodeView } from "@/content/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
  communityPaths = [],
}: {
  nodes: GraphNodeView[];
  staff?: boolean;
  communityPaths?: { topic: string; steps: number[] }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sort, setSort] = useState<LessonSort>("number");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const listed = useMemo(() => {
    const filter = { query, category, difficulty: difficulty === "" ? null : Number(difficulty) };
    return nodes.filter((node) => lessonVisible(node, filter)).sort(compareLessons(sort));
  }, [nodes, query, category, difficulty, sort]);
  const countLabel = query || category || difficulty ? `${listed.length} of ${nodes.length}` : `${nodes.length} lessons`;
  const allOpen = listed.length > 0 && listed.every((node) => expanded.has(node.id));

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
    if (!window.confirm(`Retire "${node.title}"? It leaves Lessons and its path. Restore it from Retired.`)) return;
    void changeLesson(node.id, { active: false });
  }

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          <button type="button" className="btn" onClick={() => setExpanded(allOpen ? new Set() : new Set(listed.map((node) => node.id)))}>
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
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
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-4">
          <p className="text-xs text-zinc-500">Every lesson is open. A learning path is optional.</p>
          {listed.length === 0 ? <p className="text-sm text-zinc-400">No lessons match.</p> : null}
          {listed.map((node) => {
            const open = expanded.has(node.id);
            const mastered = node.status === "mastered";
            const topics = pathTopics(node.number, communityPaths);
            return (
              <article
                key={node.id}
                className="rounded-lg border bg-[#121215]"
                style={{ borderColor: mastered ? "#10B981" : "#27272A" }}
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  <span className="w-10 shrink-0 font-mono text-xs text-zinc-500">{formatLessonNumber(node.number)}</span>
                  <Link href={node.href} className="min-w-0 flex-1 truncate text-sm text-zinc-100 hover:text-[#4ADE80]">
                    {node.title}
                  </Link>
                  <span className="hidden shrink-0 text-xs text-zinc-500 sm:block">
                    {lessonTypeLabel(node.category)} · {node.difficulty}
                  </span>
                  {mastered ? <span className="shrink-0 text-xs text-[#4ADE80]">Mastered</span> : null}
                  <button
                    type="button"
                    className="btn shrink-0"
                    aria-expanded={open}
                    aria-label={open ? `Collapse ${node.title}` : `Expand ${node.title}`}
                    onClick={() => toggle(node.id)}
                  >
                    {open ? "Collapse" : "Expand"}
                  </button>
                </div>
                {open ? (
                  <div className="flex flex-col gap-3 border-t border-[#27272A] px-3 py-3 text-sm text-zinc-400">
                    <p>{node.summary}</p>
                    <p className="text-xs text-zinc-500 sm:hidden">
                      {lessonTypeLabel(node.category)} · {node.difficulty}
                      {node.label ? ` · ${node.label}` : ""}
                    </p>
                    {node.label ? <p className="hidden text-xs text-zinc-500 sm:block">{node.label}</p> : null}
                    {topics.length > 0 ? (
                      <p className="text-xs text-zinc-500">
                        Optional path{topics.length === 1 ? "" : "s"}: {topics.join(", ")}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={node.href} className="text-sm text-[#4ADE80]">
                        Open
                      </Link>
                      <Link href={`/challenge/${node.id}/submissions`} className="text-sm text-[#4ADE80]">
                        Submissions
                      </Link>
                      {staff ? (
                        <button className="btn" type="button" disabled={busy === node.id} onClick={() => retire(node)}>
                          Retire
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
