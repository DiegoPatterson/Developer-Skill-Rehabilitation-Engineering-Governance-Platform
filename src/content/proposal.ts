import { z } from "zod";
import { assessOption } from "@/engine/cost";
import type { CostOption, CostScenario } from "@/engine/cost";
import { challenges } from "./catalog";
import type { Category, Challenge, ChallengeKind } from "./types";

export const PROPOSAL_KINDS = [
  ["patch", "Patch"],
  ["choice", "Multiple choice"],
  ["trace", "Trace"],
  ["review", "Review"],
  ["flags", "Leakage flags"],
  ["governance", "Permissions"],
  ["tradeoff", "Cost tradeoff"],
] as const;

export type ProposalKind = (typeof PROPOSAL_KINDS)[number][0];

export function proposalKindLabel(kind: string): string {
  return PROPOSAL_KINDS.find(([id]) => id === kind)?.[1] ?? kind;
}

const categories = ["debugging", "security", "comprehension", "performance", "architecture", "ml"] as const;
const ident = z.string().regex(/^[A-Za-z_$][\w$]*$/, "Use a function name made of letters, digits, and underscores.");
const lineText = z.string().trim().min(1).max(500);

const commonSchema = z.object({
  label: z.string().trim().min(2, "Label must be at least 2 characters.").max(40, "Label must be 40 characters or fewer."),
  title: z.string().trim().min(3, "Name must be at least 3 characters.").max(120, "Name must be 120 characters or fewer."),
  description: z
    .string()
    .trim()
    .min(20, "Description must be at least 20 characters.")
    .max(4000, "Description must be 4000 characters or fewer."),
  category: z.enum(categories, "Choose a track."),
  difficulty: z.number().int().min(1, "Difficulty must be from 1 to 5.").max(5, "Difficulty must be from 1 to 5."),
  showInGraph: z.boolean(),
  prereqNumbers: z.array(z.number().int().positive()).max(8, "Use at most 8 prerequisites."),
  signature: z.string().trim().max(200, "Signature must be 200 characters or fewer."),
  constraints: z.array(lineText).max(8, "Use at most 8 rules."),
  hints: z.array(lineText).max(5, "Use at most 5 hints."),
  debrief: z.string().trim().max(2000, "Debrief must be 2000 characters or fewer."),
});

const patchSchema = z
  .object({
    fileName: z.string().regex(/^[A-Za-z0-9_-]+\.js$/, "The file name must end in .js."),
    starter: z.string().min(1, "Add the starter code.").max(20_000, "Starter code is too long."),
    solution: z.string().min(1, "Add the reference solution.").max(20_000, "Reference solution is too long."),
    tests: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Name each test.").max(80),
          entry: ident,
          argsText: z.string().max(2000),
          mode: z.enum(["returns", "throws"]),
          expectText: z.string().max(2000),
          messageIncludes: z.string().max(200),
        }),
      )
      .min(1, "Add at least one test.")
      .max(12, "Use at most 12 tests."),
  })
  .superRefine((patch, ctx) => {
    if (patch.starter.trim() === patch.solution.trim()) {
      ctx.addIssue({ code: "custom", message: "The starter and the reference solution have to differ." });
    }
    patch.tests.forEach((test, index) => {
      const args = parseJson(test.argsText);
      if (!args.ok || !Array.isArray(args.value)) {
        ctx.addIssue({ code: "custom", message: `Test ${index + 1} args must be a JSON array.` });
      }
      if (test.mode === "throws" && test.messageIncludes.trim().length === 0) {
        ctx.addIssue({ code: "custom", message: `Test ${index + 1} needs the text the error must include.` });
      }
      if (test.mode === "returns" && !parseJson(test.expectText).ok) {
        ctx.addIssue({ code: "custom", message: `Test ${index + 1} expected value must be JSON.` });
      }
    });
  });

const choiceSchema = z.object({
  questions: z
    .array(
      z
        .object({
          prompt: z.string().trim().min(1, "Write the question.").max(500),
          code: z.string().max(4000),
          options: z.array(z.string().trim().min(1).max(200)).min(2, "Give each question at least two options.").max(6),
          answer: z.number().int().min(0),
          explanation: z.string().trim().min(1, "Explain the answer.").max(500),
        })
        .superRefine((question, ctx) => {
          if (question.answer >= question.options.length) {
            ctx.addIssue({ code: "custom", message: "The correct option has to be one of the options." });
          }
        }),
    )
    .min(1, "Add at least one question.")
    .max(8, "Use at most 8 questions."),
});

const traceSchema = z.object({
  code: z.string().min(1, "Add the code to trace.").max(20_000),
  checkpoints: z
    .array(
      z.object({
        prompt: z.string().trim().min(1, "Name each checkpoint.").max(200),
        answer: z.string().trim().min(1, "Give the exact answer.").max(200),
      }),
    )
    .min(1, "Add at least one checkpoint.")
    .max(12),
});

const flagsSchema = z.object({
  steps: z
    .array(z.object({ text: z.string().trim().min(1, "Describe each step.").max(300), leak: z.boolean() }))
    .min(2, "Add at least two steps.")
    .max(12),
});

const governanceSchema = z.object({
  tools: z
    .array(
      z.object({
        description: z.string().trim().min(1, "Describe each tool.").max(300),
        answer: z.enum(["allow", "ask", "deny"]),
      }),
    )
    .min(1, "Add at least one tool.")
    .max(8),
  gates: z
    .array(z.object({ description: z.string().trim().min(1, "Describe each gate.").max(300), answer: z.boolean() }))
    .min(1, "Add at least one gate.")
    .max(8),
});

const reviewSchema = z
  .object({
    files: z
      .array(
        z.object({
          name: z.string().regex(/^[A-Za-z0-9_.-]+$/, "File names use letters, digits, dots, and dashes."),
          content: z.string().min(1, "Add the file contents.").max(20_000),
        }),
      )
      .min(1, "Add the file to review.")
      .max(4),
    findings: z
      .array(
        z.object({
          file: z.string().min(1),
          anchor: z.string().trim().min(1, "Each finding needs an anchor from one line of the file.").max(200),
          category: z.string().trim().min(1, "Each finding needs a category.").max(40),
          summary: z.string().trim().min(1, "Describe each finding.").max(300),
        }),
      )
      .min(1, "Add at least one finding.")
      .max(8),
  })
  .superRefine((review, ctx) => {
    const byName = new Map(review.files.map((file) => [file.name, file.content]));
    review.findings.forEach((finding, index) => {
      const content = byName.get(finding.file);
      if (content == null) {
        ctx.addIssue({ code: "custom", message: `Finding ${index + 1} names a file that is not in the review.` });
        return;
      }
      if (!content.split(/\r?\n/).some((line) => line.includes(finding.anchor))) {
        ctx.addIssue({ code: "custom", message: `Finding ${index + 1} anchor must appear on a single line of that file.` });
      }
    });
  });

const tradeoffSchema = z
  .object({
    requestsPerDay: z.number().positive().max(1_000_000_000),
    inputTokens: z.number().nonnegative().max(1_000_000),
    outputTokens: z.number().nonnegative().max(1_000_000),
    latencyBudgetMs: z.number().positive().max(60_000),
    monthlyBudget: z.number().nonnegative().max(1_000_000_000),
    accuracyBar: z.number().min(0).max(1),
    options: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(80),
          kind: z.enum(["api", "instance", "heuristic"]),
          inputPricePerMillion: z.number().nonnegative().max(10_000),
          outputPricePerMillion: z.number().nonnegative().max(10_000),
          instances: z.number().nonnegative().max(10_000),
          hourly: z.number().nonnegative().max(10_000),
          latencyMs: z.number().nonnegative().max(60_000),
          accuracy: z.number().min(0).max(1),
          note: z.string().trim().max(300),
        }),
      )
      .min(2, "Add at least two options.")
      .max(6),
    correct: z.number().int().min(0),
  })
  .superRefine((tradeoff, ctx) => {
    if (tradeoff.correct >= tradeoff.options.length) {
      ctx.addIssue({ code: "custom", message: "Mark one option as correct." });
      return;
    }
    const scenario: CostScenario = {
      requestsPerDay: tradeoff.requestsPerDay,
      inputTokens: tradeoff.inputTokens,
      outputTokens: tradeoff.outputTokens,
      latencyBudgetMs: tradeoff.latencyBudgetMs,
      monthlyBudget: tradeoff.monthlyBudget,
      accuracyBar: tradeoff.accuracyBar,
    };
    const fits = tradeoff.options.filter((option) => assessOption(toCostOption(option, "check"), scenario).fits);
    if (fits.length !== 1) {
      ctx.addIssue({ code: "custom", message: "Exactly one option must meet the latency, budget, and accuracy bars." });
      return;
    }
    if (tradeoff.options[tradeoff.correct] !== fits[0]) {
      ctx.addIssue({ code: "custom", message: "The correct option has to be the one that meets every bar." });
    }
  });

const kindSchemas = {
  patch: patchSchema,
  choice: choiceSchema,
  trace: traceSchema,
  review: reviewSchema,
  flags: flagsSchema,
  governance: governanceSchema,
  tradeoff: tradeoffSchema,
} as const;

export type ProposalDraft = z.infer<typeof commonSchema> & {
  kind: ProposalKind;
  patch?: z.infer<typeof patchSchema>;
  choice?: z.infer<typeof choiceSchema>;
  trace?: z.infer<typeof traceSchema>;
  review?: z.infer<typeof reviewSchema>;
  flags?: z.infer<typeof flagsSchema>;
  governance?: z.infer<typeof governanceSchema>;
  tradeoff?: z.infer<typeof tradeoffSchema>;
};

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "This problem is incomplete.";
}

export function parseProposal(input: unknown): { ok: true; draft: ProposalDraft } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "This problem is incomplete." };
  const kind = (input as { kind?: unknown }).kind;
  if (typeof kind !== "string" || !kindSchemas[kind as ProposalKind]) {
    return { ok: false, error: "Choose a question type." };
  }
  const common = commonSchema.safeParse(input);
  if (!common.success) return { ok: false, error: firstIssue(common.error) };
  const unique = new Set(common.data.prereqNumbers);
  if (unique.size !== common.data.prereqNumbers.length) return { ok: false, error: "List each prerequisite once." };
  const selected = kind as ProposalKind;
  const details = kindSchemas[selected].safeParse((input as Record<string, unknown>)[selected]);
  if (!details.success) return { ok: false, error: firstIssue(details.error) };
  return { ok: true, draft: { ...common.data, kind: selected, [selected]: details.data } };
}

export function nextLessonNumber(used: Iterable<number>): number {
  let max = 0;
  for (const number of used) if (Number.isFinite(number) && number > max) max = number;
  return max + 1;
}

export function publishedLessons(extra: { number: number; id: string }[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const challenge of challenges) map.set(challenge.number, challenge.id);
  for (const item of extra) map.set(item.number, item.id);
  return map;
}

export function resolvePrereqNumbers(
  numbers: number[],
  published: Map<number, string>,
): { ids: string[] } | { error: string } {
  const ids: string[] = [];
  for (const number of numbers) {
    const id = published.get(number);
    if (!id) return { error: `Lesson #${number} is not published yet.` };
    ids.push(id);
  }
  return { ids };
}

function summaryOf(description: string): string {
  const flat = description.replace(/\s+/g, " ").trim();
  return flat.length <= 240 ? flat : `${flat.slice(0, 237)}...`;
}

function blocks(text: string): { type: "p"; text: string }[] {
  const trimmed = text.trim();
  return trimmed ? [{ type: "p", text: trimmed }] : [];
}

function toCostOption(option: z.infer<typeof tradeoffSchema>["options"][number], id: string): CostOption {
  return {
    id,
    title: option.title,
    kind: option.kind,
    inputPricePerMillion: option.inputPricePerMillion,
    outputPricePerMillion: option.outputPricePerMillion,
    instances: option.instances,
    hourly: option.hourly,
    latencyMs: option.latencyMs,
    accuracy: option.accuracy,
    note: option.note,
  };
}

export function toChallenge(draft: ProposalDraft, number: number, id: string, prereqs: string[]): Challenge {
  const base = {
    id,
    number,
    title: draft.title,
    label: draft.label,
    category: draft.category as Category,
    difficulty: draft.difficulty,
    summary: summaryOf(draft.description),
    showInGraph: draft.showInGraph,
    prereqs,
    x: 0,
    y: 0,
    kind: draft.kind as ChallengeKind,
    brief: blocks(draft.description),
    constraints: draft.constraints,
    signature: draft.signature,
    hints: draft.hints,
    debrief: blocks(draft.debrief),
  };

  if (draft.kind === "patch" && draft.patch) {
    return {
      ...base,
      files: [{ name: draft.patch.fileName, starter: draft.patch.starter, solution: draft.patch.solution }],
      steps: draft.patch.tests.map((test) => {
        const args = parseJson(test.argsText);
        const step = {
          type: test.mode === "throws" ? "throws" : "call",
          name: test.name,
          entry: test.entry,
          args: args.ok && Array.isArray(args.value) ? args.value : [],
        };
        if (test.mode === "throws") return { ...step, messageIncludes: test.messageIncludes.trim() };
        const expect = parseJson(test.expectText);
        return { ...step, expect: expect.ok ? expect.value : null };
      }),
    };
  }

  if (draft.kind === "choice" && draft.choice) {
    return {
      ...base,
      questions: draft.choice.questions.map((question, index) => ({
        id: `q${index + 1}`,
        prompt: question.prompt,
        code: question.code.trim() || undefined,
        options: question.options.map((label, optionIndex) => ({ id: `o${optionIndex + 1}`, label })),
        answer: `o${question.answer + 1}`,
        explanation: question.explanation,
      })),
    };
  }

  if (draft.kind === "trace" && draft.trace) {
    return {
      ...base,
      traceCode: draft.trace.code,
      checkpoints: draft.trace.checkpoints.map((checkpoint, index) => ({
        id: `c${index + 1}`,
        prompt: checkpoint.prompt,
        answer: checkpoint.answer,
      })),
    };
  }

  if (draft.kind === "flags" && draft.flags) {
    return {
      ...base,
      pipeline: draft.flags.steps.map((step, index) => ({ id: `s${index + 1}`, text: step.text, leak: step.leak })),
    };
  }

  if (draft.kind === "governance" && draft.governance) {
    return {
      ...base,
      tools: draft.governance.tools.map((tool, index) => ({
        id: `t${index + 1}`,
        description: tool.description,
        answer: tool.answer,
      })),
      gates: draft.governance.gates.map((gate, index) => ({
        id: `g${index + 1}`,
        description: gate.description,
        answer: gate.answer,
      })),
    };
  }

  if (draft.kind === "review" && draft.review) {
    const categories = [...new Set(draft.review.findings.map((finding) => finding.category))];
    return {
      ...base,
      categories,
      reviewFiles: draft.review.files,
      findings: draft.review.findings.map((finding) => ({ ...finding, tolerance: 3 })),
    };
  }

  if (draft.kind === "tradeoff" && draft.tradeoff) {
    const options = draft.tradeoff.options.map((option, index) => toCostOption(option, `o${index + 1}`));
    return {
      ...base,
      scenario: {
        requestsPerDay: draft.tradeoff.requestsPerDay,
        inputTokens: draft.tradeoff.inputTokens,
        outputTokens: draft.tradeoff.outputTokens,
        latencyBudgetMs: draft.tradeoff.latencyBudgetMs,
        monthlyBudget: draft.tradeoff.monthlyBudget,
        accuracyBar: draft.tradeoff.accuracyBar,
      },
      options,
      correctOptionId: `o${draft.tradeoff.correct + 1}`,
    };
  }

  return base;
}

export type ApprovedProposalRow = {
  payload: unknown;
  lessonNumber: number | null;
  nodeId: string | null;
};

export function challengesFromApproved(rows: ApprovedProposalRow[]): Challenge[] {
  const sorted = [...rows].sort((a, b) => (a.lessonNumber ?? 0) - (b.lessonNumber ?? 0));
  const published = publishedLessons([]);
  const built: Challenge[] = [];
  for (const row of sorted) {
    if (row.lessonNumber == null || !row.nodeId) continue;
    const parsed = parseProposal(row.payload);
    if (!parsed.ok) continue;
    const resolved = resolvePrereqNumbers(parsed.draft.prereqNumbers, published);
    if ("error" in resolved) continue;
    const challenge = toChallenge(parsed.draft, row.lessonNumber, row.nodeId, resolved.ids);
    published.set(challenge.number, challenge.id);
    built.push(challenge);
  }
  return built;
}
