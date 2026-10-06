"use client";

import { formatLessonNumber, formatRequirement } from "@/content/lesson";
import { LESSON_PATHS, lessonPath } from "@/content/paths";
import type { GraphNodeView, GraphStatus } from "@/content/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";

const PATH_KEY = "sg-learn-path";
const PATH_IDS = new Set(LESSON_PATHS.map((path) => path.id));

function readSavedPath(): string | null {
  try {
    const saved = localStorage.getItem(PATH_KEY);
    return saved && PATH_IDS.has(saved) ? saved : null;
  } catch {
    return null;
  }
}

function usePath(): [string, (id: string) => void] {
  const saved = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("sg-learn-path", onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener("sg-learn-path", onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    readSavedPath,
    () => null,
  );
  const choose = (id: string) => {
    if (!PATH_IDS.has(id)) return;
    try {
      localStorage.setItem(PATH_KEY, id);
    } catch {
      return;
    }
    window.dispatchEvent(new Event("sg-learn-path"));
  };
  return [saved ?? "debugging", choose];
}

function openNode(router: ReturnType<typeof useRouter>, href: string, status: GraphStatus) {
  if (status === "locked") return;
  router.push(href);
}

export function LessonPaths({ nodes }: { nodes: GraphNodeView[] }) {
  const router = useRouter();
  const [pathId, setPathId] = usePath();
  const path = lessonPath(pathId);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const byNumber = useMemo(() => new Map(nodes.map((node) => [node.number, node])), [nodes]);

  return (
    <div className="skill-board">
      <div className="flex flex-col gap-3 border-b border-[#27272A] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">{path.blurb}</p>
          <Link href="/lessons" className="text-sm text-[#4ADE80]">
            All lessons
          </Link>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Learning paths">
          {LESSON_PATHS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === path.id}
              className={`btn ${item.id === path.id ? "btn-primary" : ""}`}
              onClick={() => setPathId(item.id)}
            >
              {item.title}
            </button>
          ))}
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
            const locked = node.status === "locked";
            const mastered = node.status === "mastered";
            const requirement = locked
              ? formatRequirement(node.prereqs.map((id) => byId.get(id)?.number).filter((value): value is number => value != null))
              : "";
            return (
              <li key={node.id} className="relative pb-6 pl-10">
                {last ? null : <span className="absolute top-6 left-[11px] h-[calc(100%-12px)] w-px bg-[#3f3f46]" />}
                <span
                  className="absolute top-3 left-0 flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px]"
                  style={{ borderColor: mastered ? "#10B981" : "#3f3f46", color: mastered ? "#4ADE80" : "#a1a1aa" }}
                >
                  {index + 1}
                </span>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => openNode(router, node.href, node.status)}
                  className="w-full rounded-lg border px-3 py-3 text-left"
                  style={{
                    background: mastered ? "#052e16" : "#121215",
                    borderColor: locked ? "#3f3f46" : "#10B981",
                    opacity: locked ? 0.55 : 1,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{node.category}</div>
                    <div className="font-mono text-xs text-zinc-300">{formatLessonNumber(node.number)}</div>
                  </div>
                  <div className="mt-1 text-sm font-medium text-zinc-100">{node.title}</div>
                  <div className="mt-2 text-xs text-[#4ADE80]">{mastered ? "Mastered" : locked ? "Locked" : "Open"}</div>
                  {requirement ? <div className="mt-1 text-xs text-zinc-400">{requirement}</div> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
