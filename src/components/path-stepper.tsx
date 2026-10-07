"use client";

import { FavoritePathButton } from "@/components/favorite-path-button";
import { formatLessonNumber } from "@/content/lesson";
import type { PublishedPath } from "@/content/path-proposal";
import { formatPathDifficulty, formatProblemCount } from "@/content/paths";
import type { GraphNodeView } from "@/content/view-model";
import Link from "next/link";
import { useMemo, useState } from "react";

export function PathStepper({ path, nodes, favorite }: { path: PublishedPath; nodes: GraphNodeView[]; favorite: boolean }) {
  const [on, setOn] = useState(favorite);
  const byNumber = useMemo(() => new Map(nodes.map((node) => [node.number, node])), [nodes]);
  const levels = path.steps.map((number) => byNumber.get(number)?.difficulty).filter((level): level is number => level != null);

  return (
    <div className="skill-board">
      <div className="flex flex-col gap-3 border-b border-[#27272A] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-medium text-zinc-100">{path.topic}</h1>
            <p className="mt-1 font-mono text-xs text-zinc-500">
              {formatProblemCount(path.steps.length)} · Difficulty {formatPathDifficulty(levels)}
            </p>
            <p className="mt-2 text-sm text-zinc-400">{path.description}</p>
            <p className="mt-1 text-xs text-zinc-500">Optional. Every lesson on this path stays open.</p>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-3">
            <FavoritePathButton pathId={path.id} topic={path.topic} favorite={on} onChange={setOn} />
            <Link href="/learn" className="text-sm text-[#4ADE80]">
              All paths
            </Link>
            <Link href="/lessons" className="text-sm text-[#4ADE80]">
              All lessons
            </Link>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <ol className="mx-auto flex w-full max-w-xl flex-col px-4 py-6">
          {path.steps.map((number, index) => {
            const node = byNumber.get(number);
            const last = index === path.steps.length - 1;
            if (!node) {
              return (
                <li key={number} className="relative pb-6 pl-10">
                  {last ? null : <span className="absolute top-6 left-[11px] h-[calc(100%-12px)] w-px bg-[#27272A]" />}
                  <span className="absolute top-3 left-0 flex h-6 w-6 items-center justify-center rounded-full border border-[#3f3f46] font-mono text-[10px] text-zinc-500">
                    {index + 1}
                  </span>
                  <div className="rounded-lg border border-[#27272A] bg-[#121215] px-3 py-3 text-sm text-zinc-500">
                    {formatLessonNumber(number)} is not in the lesson list.
                  </div>
                </li>
              );
            }
            const mastered = node.status === "mastered";
            return (
              <li key={node.id} className="relative pb-6 pl-10">
                {last ? null : <span className="absolute top-6 left-[11px] h-[calc(100%-12px)] w-px bg-[#3f3f46]" />}
                <span
                  className="absolute top-3 left-0 flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px]"
                  style={{ borderColor: mastered ? "#10B981" : "#3f3f46", color: mastered ? "#4ADE80" : "#a1a1aa" }}
                >
                  {index + 1}
                </span>
                <Link
                  href={node.href}
                  className="block w-full rounded-lg border px-3 py-3 text-left"
                  style={{
                    background: mastered ? "#052e16" : "#121215",
                    borderColor: mastered ? "#10B981" : "#27272A",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{node.category}</div>
                    <div className="font-mono text-xs text-zinc-300">{formatLessonNumber(node.number)}</div>
                  </div>
                  <div className="mt-1 text-sm font-medium text-zinc-100">{node.title}</div>
                  {mastered ? <div className="mt-2 text-xs text-[#4ADE80]">Mastered</div> : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
