"use client";

import { FavoritePathButton } from "@/components/favorite-path-button";
import { formatLessonNumber, lessonTypeLabel } from "@/content/lesson";
import type { PublishedPath } from "@/content/path-proposal";
import { LESSON_PATHS, formatPathDifficulty, formatProblemCount, orderFavoritedFirst } from "@/content/paths";
import type { GraphNodeView } from "@/content/view-model";
import Link from "next/link";
import { useMemo, useState } from "react";

type ShownPath = { id: string; topic: string; description: string; steps: number[] };

export function LessonPaths({
  nodes,
  community,
  favoriteIds,
}: {
  nodes: GraphNodeView[];
  community: PublishedPath[];
  favoriteIds: string[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState(favoriteIds);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const byNumber = useMemo(() => new Map(nodes.map((node) => [node.number, node])), [nodes]);
  const paths: ShownPath[] = [
    ...LESSON_PATHS.map((path) => ({ id: path.id, topic: path.title, description: path.blurb, steps: path.steps })),
    ...community,
  ];
  const favoriteSet = new Set(favorites);
  const ordered = orderFavoritedFirst(paths, favorites);
  const visible = onlyFavorites ? ordered.filter((path) => favoriteSet.has(path.id)) : ordered;
  const allOpen = visible.length > 0 && visible.every((path) => expanded.has(path.id));

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
      <div className="flex flex-wrap items-center gap-3 border-b border-[#27272A] px-4 py-3">
        <p className="text-sm text-zinc-400">Optional paths. Open any lesson, in any order.</p>
        <button type="button" className={`btn ${onlyFavorites ? "" : "btn-primary"}`} aria-pressed={!onlyFavorites} onClick={() => setOnlyFavorites(false)}>
          All
        </button>
        <button type="button" className={`btn ${onlyFavorites ? "btn-primary" : ""}`} aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(true)}>
          Favorites
        </button>
        <button type="button" className="btn" onClick={() => setExpanded(allOpen ? new Set() : new Set(visible.map((path) => path.id)))}>
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
        <Link href="/lessons" className="text-sm text-[#4ADE80]">
          All lessons
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-4">
          {visible.length === 0 ? <p className="text-sm text-zinc-500">You have not favorited a path yet.</p> : null}
          {visible.map((path) => {
            const open = expanded.has(path.id);
            const levels = path.steps
              .map((number) => byNumber.get(number)?.difficulty)
              .filter((level): level is number => level != null);
            return (
              <article key={path.id} className="rounded-lg border border-[#27272A] bg-[#121215] hover:border-[#3f3f46]">
                <div className="relative">
                  <Link
                    href={`/learn/${path.id}`}
                    aria-labelledby={`path-title-${path.id}`}
                    className="absolute inset-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ADE80]"
                  />
                  <div className="pointer-events-none flex items-start gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 id={`path-title-${path.id}`} className="text-sm font-medium text-zinc-100">{path.topic}</h2>
                      <p className="font-mono text-xs text-zinc-500">
                        {formatProblemCount(path.steps.length)} · Difficulty {formatPathDifficulty(levels)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">{path.description}</p>
                  </div>
                  <div className="pointer-events-auto relative z-10 flex shrink-0 flex-wrap justify-end gap-2">
                    <FavoritePathButton
                      pathId={path.id}
                      topic={path.topic}
                      favorite={favoriteSet.has(path.id)}
                      onChange={(next) =>
                        setFavorites((current) => (next ? [path.id, ...current.filter((id) => id !== path.id)] : current.filter((id) => id !== path.id)))
                      }
                    />
                    <button
                      type="button"
                      className="btn"
                      aria-expanded={open}
                      aria-label={open ? `Collapse ${path.topic}` : `Expand ${path.topic}`}
                      onClick={() => toggle(path.id)}
                    >
                      {open ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  </div>
                </div>
                {open ? (
                  <ol className="flex flex-col gap-2 border-t border-[#27272A] px-3 py-3">
                    {path.steps.map((number, index) => {
                      const node = byNumber.get(number);
                      if (!node) {
                        return (
                          <li key={number} className="rounded-md border border-[#27272A] px-3 py-2 text-sm text-zinc-500">
                            {index + 1}. {formatLessonNumber(number)} is not in the lesson list.
                          </li>
                        );
                      }
                      return (
                        <li key={node.id}>
                          <Link
                            href={node.href}
                            className="flex items-center gap-3 rounded-md border px-3 py-2"
                            style={{
                              background: node.status === "mastered" ? "#052e16" : "#09090B",
                              borderColor: node.status === "mastered" ? "#10B981" : "#27272A",
                            }}
                          >
                            <span className="w-6 shrink-0 font-mono text-xs text-zinc-500">{index + 1}</span>
                            <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                              {formatLessonNumber(node.number)} {node.title}
                            </span>
                            <span className="hidden shrink-0 text-xs text-zinc-500 sm:block">
                              {lessonTypeLabel(node.category)} · {node.difficulty}
                            </span>
                            {node.status === "mastered" ? <span className="shrink-0 text-xs text-[#4ADE80]">Mastered</span> : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
