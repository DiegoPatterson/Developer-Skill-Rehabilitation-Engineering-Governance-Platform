export type AttemptRecord = {
  id: string;
  userId: string;
  username: string;
  passed: boolean;
  score: number | null;
  executionTimeMs: number | null;
  timeToFixMs: number | null;
  hintsUsed: number;
  submittedAt: string;
};

export type ShownSubmission = {
  files: { name: string; text: string }[];
  notes: { label: string; text: string }[];
};

function missingLast(left: number | null, right: number | null): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left - right;
}

/** Best pass first: higher score, faster run, fewer hints, shorter solve, then earlier submit. */
export function optimalRank(left: AttemptRecord, right: AttemptRecord): number {
  const score = (right.score ?? -1) - (left.score ?? -1);
  if (score !== 0) return score;
  const run = missingLast(left.executionTimeMs, right.executionTimeMs);
  if (run !== 0) return run;
  const hints = left.hintsUsed - right.hintsUsed;
  if (hints !== 0) return hints;
  const worked = missingLast(left.timeToFixMs, right.timeToFixMs);
  if (worked !== 0) return worked;
  return left.submittedAt.localeCompare(right.submittedAt) || left.id.localeCompare(right.id);
}

/** One passing attempt per person. Failed attempts stay out of this list. */
export function bestPerUser(rows: AttemptRecord[]): AttemptRecord[] {
  const best = new Map<string, AttemptRecord>();
  for (const row of rows) {
    if (!row.passed) continue;
    const current = best.get(row.userId);
    if (!current || optimalRank(row, current) < 0) best.set(row.userId, row);
  }
  return [...best.values()].sort(optimalRank);
}

export function newestFirst(rows: AttemptRecord[]): AttemptRecord[] {
  return [...rows].sort((left, right) => right.submittedAt.localeCompare(left.submittedAt) || right.id.localeCompare(left.id));
}

export function formatRun(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textPairs(value: unknown, label: string): { label: string; text: string }[] {
  const body = record(value);
  if (!body) return [];
  return Object.entries(body)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([key, text]) => ({ label, text: `${key}: ${text}` }));
}

export function presentSubmission(raw: string): ShownSubmission {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { files: [], notes: raw.trim() ? [{ label: "Submission", text: raw }] : [] };
  }
  const body = record(parsed);
  if (!body) return { files: [], notes: [{ label: "Submission", text: raw }] };

  const files: ShownSubmission["files"] = [];
  const fileMap = record(body.files);
  if (fileMap) {
    for (const [name, text] of Object.entries(fileMap)) {
      if (typeof text === "string") files.push({ name, text });
    }
  }

  const notes: ShownSubmission["notes"] = [];
  notes.push(...textPairs(body.values, "Trace"));
  notes.push(...textPairs(body.answers, "Answer"));
  if (typeof body.choice === "string" && body.choice) notes.push({ label: "Choice", text: body.choice });
  if (Array.isArray(body.flagged)) {
    const flagged = body.flagged.filter((item): item is string => typeof item === "string");
    if (flagged.length > 0) notes.push({ label: "Flagged", text: flagged.join(", ") });
  }
  if (Array.isArray(body.comments)) {
    for (const item of body.comments) {
      const comment = record(item);
      if (!comment || typeof comment.text !== "string") continue;
      const file = typeof comment.file === "string" ? comment.file : "file";
      const line = typeof comment.line === "number" ? String(comment.line) : "?";
      const category = typeof comment.category === "string" ? comment.category : "note";
      notes.push({ label: "Comment", text: `${file}:${line} ${category} — ${comment.text}` });
    }
  }
  const tools = record(body.tools);
  if (tools) {
    const listed = Object.entries(tools)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([name, value]) => `${name}: ${value}`);
    if (listed.length > 0) notes.push({ label: "Tools", text: listed.join("\n") });
  }
  const gates = record(body.gates);
  if (gates) {
    const listed = Object.entries(gates)
      .filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
      .map(([name, value]) => `${name}: ${value ? "on" : "off"}`);
    if (listed.length > 0) notes.push({ label: "Gates", text: listed.join("\n") });
  }
  if (body.spec && typeof body.spec === "object") {
    notes.push({ label: "Spec", text: JSON.stringify(body.spec, null, 2) });
  }
  return { files, notes };
}
