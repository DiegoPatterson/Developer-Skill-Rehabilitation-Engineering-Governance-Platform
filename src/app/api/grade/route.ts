import { evaluateChallenge } from "@/content/evaluate";
import type { GradePayload, GradeResponse } from "@/content/payload";
import { createSource } from "@/content/source";
import { getViewer } from "@/server/auth";
import { json, logSafe, readJson } from "@/server/http";
import { createStore } from "@/server/store";
import type { SpecInput } from "@/engine/spec";
import { z } from "zod";

const specSchema = z.object({
  title: z.string().max(200),
  summary: z.string().max(4000),
  nonGoals: z.string().max(4000),
  endpoints: z
    .array(
      z.object({
        method: z.string().max(20),
        path: z.string().max(200),
        auth: z.string().max(500),
        errors: z.string().max(500),
        request: z.string().max(1000),
        response: z.string().max(1000),
      }),
    )
    .max(8),
  entities: z.array(z.object({ name: z.string().max(200), fields: z.string().max(2000) })).max(8),
  acceptance: z.string().max(4000),
});

const bodySchema = z.object({
  nodeId: z.string().regex(/^[a-z0-9-]{1,100}$/),
  mode: z.enum(["run", "submit"]),
  files: z.record(z.string().max(120), z.string().max(80_000)).optional(),
  values: z.record(z.string().max(80), z.string().max(200)).optional(),
  answers: z.record(z.string().max(80), z.string().max(80)).optional(),
  comments: z
    .array(
      z.object({
        file: z.string().max(120),
        line: z.number().int().min(1).max(5000),
        category: z.string().max(40),
        text: z.string().max(2000),
      }),
    )
    .max(40)
    .optional(),
  spec: specSchema.optional(),
  flagged: z.array(z.string().max(80)).max(40).optional(),
  tools: z.record(z.string().max(80), z.enum(["allow", "ask", "deny"])).optional(),
  gates: z.record(z.string().max(80), z.boolean()).optional(),
  choice: z.string().max(80).optional(),
});

function payloadOf(data: z.infer<typeof bodySchema>): GradePayload {
  return {
    files: data.files,
    values: data.values,
    answers: data.answers,
    comments: data.comments,
    spec: data.spec as SpecInput | undefined,
    flagged: data.flagged,
    tools: data.tools,
    gates: data.gates,
    choice: data.choice,
  };
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Sign in required." }, 401);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, 400);
  if (parsed.data.files && Object.keys(parsed.data.files).length > 8) {
    return json({ error: "Too many files." }, 400);
  }
  const encoded = JSON.stringify(parsed.data);
  if (encoded.length > 200_000) return json({ error: "Submission is too large." }, 413);
  const challenge = createSource().get(parsed.data.nodeId);
  if (!challenge) return json({ error: "Unknown challenge." }, 404);
  try {
    const store = createStore();
    const payload = payloadOf(parsed.data);
    const reveal = parsed.data.mode === "submit";
    const evaluation = await evaluateChallenge(challenge, payload, reveal);
    const precisionTest = evaluation.tests.find((test) => test.name === "Precision");
    const precision = precisionTest ? Number(precisionTest.message) : null;
    if (parsed.data.mode === "run") {
      const body: GradeResponse = {
        evaluation,
        mode: "run",
        storedScore: null,
        mastered: null,
        late: null,
        hintsUsed: 0,
        overallElo: null,
        streak: null,
        shields: null,
      };
      return json(body);
    }
    const recorded = await store.recordSubmission({
      userId: viewer.id,
      nodeId: challenge.id,
      kind: challenge.kind,
      category: challenge.category,
      difficulty: challenge.difficulty,
      codeSubmitted: encoded.slice(0, 100_000),
      passedAll: evaluation.passedAll,
      performance: evaluation.performance,
      correctness: evaluation.correctness,
      maintainability: evaluation.maintainability,
      executionTimeMs: evaluation.executionTimeMs,
      rawScore: evaluation.score,
      precision: precision != null && Number.isFinite(precision) ? precision : null,
    });
    const body: GradeResponse = {
      evaluation,
      mode: "submit",
      storedScore: recorded.storedScore,
      mastered: recorded.mastered,
      late: recorded.late,
      hintsUsed: recorded.hintsUsed,
      overallElo: recorded.overallElo,
      streak: recorded.streak,
      shields: recorded.shields,
    };
    return json(body);
  } catch (error) {
    logSafe(error);
    const message = error instanceof Error ? error.message : "";
    if (message === "Unknown challenge.") return json({ error: message }, 404);
    if (message.includes("firebase-migration")) return json({ error: message }, 501);
    return json({ error: "The grader failed." }, 500);
  }
}
