import type { Category, Challenge, ChallengeKind } from "./types";

const KINDS = new Set<ChallengeKind>(["patch", "incident", "trace", "review", "choice", "spec", "flags", "governance", "tradeoff"]);
const CATEGORIES = new Set<Category>(["debugging", "security", "comprehension", "performance", "architecture", "ml"]);

export type CatalogRow = {
  id: string;
  title: string;
  category: string;
  prerequisiteNodeIds: string[];
  difficultyLevel: number;
  summary: string;
  showInGraph: boolean;
  lessonNumber: number | null;
  kind: string;
  label: string;
  active: boolean;
  positionX: number | null;
  positionY: number | null;
  payload: unknown;
};

export function challengeJson(challenge: Challenge): unknown {
  return JSON.parse(JSON.stringify(challenge)) as unknown;
}

export function challengeFromRow(row: CatalogRow): Challenge | null {
  if (!row.active) return null;
  if (row.lessonNumber == null || !Number.isInteger(row.lessonNumber) || row.lessonNumber < 1) return null;
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) return null;
  const payload = row.payload as Partial<Challenge>;
  const kind = KINDS.has(row.kind as ChallengeKind) ? (row.kind as ChallengeKind) : payload.kind;
  const category = CATEGORIES.has(row.category as Category) ? (row.category as Category) : payload.category;
  if (!kind || !KINDS.has(kind) || !category || !CATEGORIES.has(category)) return null;
  if (!Array.isArray(payload.brief) || typeof payload.signature !== "string") return null;
  const placed =
    row.positionX != null && row.positionY != null && Number.isFinite(row.positionX) && Number.isFinite(row.positionY);
  return {
    ...payload,
    id: row.id,
    number: row.lessonNumber,
    title: row.title,
    label: row.label || payload.label || "",
    category,
    difficulty: row.difficultyLevel,
    summary: row.summary,
    showInGraph: row.showInGraph,
    prereqs: row.prerequisiteNodeIds,
    kind,
    brief: payload.brief,
    constraints: payload.constraints ?? [],
    signature: payload.signature,
    hints: payload.hints ?? [],
    debrief: payload.debrief ?? [],
    placed,
    x: placed ? row.positionX! : 0,
    y: placed ? row.positionY! : 0,
  };
}
