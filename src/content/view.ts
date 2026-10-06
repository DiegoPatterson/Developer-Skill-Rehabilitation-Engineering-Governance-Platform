import "server-only";
import { buildCfg } from "@/engine/cfg";
import { isLocked } from "@/server/outcome";
import { toPublic } from "./public";
import type { Challenge } from "./types";
import type { GraphNodeView, SkillLink, WorkspaceView } from "./view-model";

export function skillLinks(list: Challenge[]): SkillLink[] {
  return list.map((challenge) => ({ id: challenge.id, title: challenge.title, number: challenge.number }));
}

export function graphNodeViews(list: Challenge[], mastered: ReadonlySet<string>): GraphNodeView[] {
  return list.map((challenge) => ({
    id: challenge.id,
    number: challenge.number,
    title: challenge.title,
    label: challenge.label ?? "",
    category: challenge.category,
    summary: challenge.summary,
    difficulty: challenge.difficulty,
    x: challenge.placed === true ? challenge.x : 0,
    y: challenge.placed === true ? challenge.y : 0,
    placed: challenge.placed === true,
    prereqs: challenge.prereqs,
    status: mastered.has(challenge.id)
      ? "mastered"
      : isLocked(challenge.kind, challenge.prereqs, mastered)
        ? "locked"
        : "in_progress",
    inGraph: challenge.showInGraph,
    href: challenge.kind === "incident" ? "/outage" : `/challenge/${challenge.id}`,
  }));
}

export function toWorkspace(
  challenge: Challenge,
  mastered: ReadonlySet<string>,
  titles: Map<string, { title: string; number: number }>,
): WorkspaceView {
  const locked = isLocked(challenge.kind, challenge.prereqs, mastered);
  const pub = toPublic(challenge);
  const missing = challenge.prereqs
    .filter((id) => !mastered.has(id))
    .map((id) => {
      const known = titles.get(id);
      return { id, title: known?.title ?? id, number: known?.number ?? 0 };
    });
  let cfg: WorkspaceView["cfg"] = null;
  if (!locked && challenge.cfgSource) cfg = buildCfg(challenge.cfgSource);
  return {
    ...pub,
    files: locked ? [] : pub.files,
    reviewFiles: locked ? [] : pub.reviewFiles,
    locked,
    missing,
    scenario: locked ? null : (challenge.scenario ?? null),
    options: locked ? [] : (challenge.options ?? []),
    cfg,
    traceFile: challenge.files?.find((file) => file.traceSource)?.name ?? null,
  };
}
