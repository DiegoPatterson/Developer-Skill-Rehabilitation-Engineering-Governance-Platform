import "server-only";
import { buildCfg } from "@/engine/cfg";
import { isLocked } from "@/server/outcome";
import { toPublic } from "./public";
import type { Challenge } from "./types";
import type { GraphNodeView, SkillLink, WorkspaceView } from "./view-model";

export function skillLinks(list: Challenge[]): SkillLink[] {
  return list.map((challenge) => ({ id: challenge.id, title: challenge.title }));
}

export function graphNodeViews(list: Challenge[], mastered: ReadonlySet<string>): GraphNodeView[] {
  return list
    .filter((challenge) => challenge.showInGraph)
    .map((challenge) => ({
      id: challenge.id,
      title: challenge.title,
      category: challenge.category,
      summary: challenge.summary,
      difficulty: challenge.difficulty,
      x: challenge.x,
      y: challenge.y,
      prereqs: challenge.prereqs,
      status: mastered.has(challenge.id)
        ? "mastered"
        : isLocked(challenge.kind, challenge.prereqs, mastered)
          ? "locked"
          : "in_progress",
    }));
}

export function toWorkspace(challenge: Challenge, mastered: ReadonlySet<string>, titles: Map<string, string>): WorkspaceView {
  const locked = isLocked(challenge.kind, challenge.prereqs, mastered);
  const pub = toPublic(challenge);
  const missing = challenge.prereqs
    .filter((id) => !mastered.has(id))
    .map((id) => ({ id, title: titles.get(id) ?? id }));
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
