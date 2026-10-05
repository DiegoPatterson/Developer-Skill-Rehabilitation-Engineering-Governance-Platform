import { assessOption } from "@/engine/cost";
import { maintainabilityScore } from "@/engine/maintainability";
import { lineOf, scoreReview, type ReviewComment } from "@/engine/review";
import { jaccard, patchScore } from "@/engine/score";
import { scoreSpec, type SpecInput } from "@/engine/spec";
import { getSandbox, type SandboxStep, type SandboxStepResult } from "@/sandbox/run";
import type { Block, Challenge } from "./types";

export type Evaluation = {
  tests: { name: string; passed: boolean; message: string }[];
  correctness: number;
  performance: number;
  maintainability: number;
  score: number;
  passedAll: boolean;
  executionTimeMs: number | null;
  debrief: Block[] | null;
  explanations: { id: string; correct: boolean; explanation: string }[] | null;
  missed: string[] | null;
  checks: { id: string; ok: boolean; points: number; detail: string }[] | null;
};

type Payload = {
  files?: Record<string, string>;
  values?: Record<string, string>;
  answers?: Record<string, string>;
  comments?: ReviewComment[];
  spec?: SpecInput;
  flagged?: string[];
  tools?: Record<string, "allow" | "ask" | "deny">;
  gates?: Record<string, boolean>;
  choice?: string;
};

function blank(partial: Partial<Evaluation>): Evaluation {
  return {
    tests: [],
    correctness: 0,
    performance: 1,
    maintainability: 1,
    score: 0,
    passedAll: false,
    executionTimeMs: null,
    debrief: null,
    explanations: null,
    missed: null,
    checks: null,
    ...partial,
  };
}

function finish(challenge: Challenge, result: Evaluation, reveal: boolean, passed: boolean): Evaluation {
  return { ...result, debrief: reveal && passed ? challenge.debrief : null };
}

function referenceFiles(challenge: Challenge): { files: Record<string, string>; order: string[] } {
  const files: Record<string, string> = {};
  const order = (challenge.files ?? []).map((file) => file.name);
  for (const file of challenge.files ?? []) files[file.name] = file.solution;
  return { files, order };
}

export function submittedFiles(challenge: Challenge, incoming: Record<string, string> | undefined) {
  const files: Record<string, string> = {};
  const order = (challenge.files ?? []).map((file) => file.name);
  for (const name of order) files[name] = incoming?.[name] ?? "";
  return { files, order };
}

async function runSteps(files: Record<string, string>, order: string[], steps: SandboxStep[], wallMs: number) {
  if (steps.length === 0) return [];
  const output = await getSandbox().run({ files, order, steps }, wallMs);
  if (!output.ok) {
    return steps.map((step) => ({
      name: step.name,
      passed: false,
      message: output.error ?? "Sandbox failed.",
      ms: wallMs,
      data: null,
    }));
  }
  return output.results;
}

async function evaluatePatch(challenge: Challenge, payload: Payload, reveal: boolean): Promise<Evaluation> {
  const { files, order } = submittedFiles(challenge, payload.files);
  const steps = (challenge.steps ?? []) as SandboxStep[];
  const functional = steps.filter((step) => step.type !== "bench");
  const benches = steps.filter((step) => step.type === "bench");
  const functionalResults = await runSteps(files, order, functional, 5000);
  const benchResults: SandboxStepResult[] = [];
  for (const step of benches) {
    const [result] = await runSteps(files, order, [step], 7000);
    benchResults.push(result);
  }
  const results = [...functionalResults, ...benchResults];
  const functionalPassed = functionalResults.filter((result) => result.passed).length;
  const correctness = functional.length === 0 ? 1 : functionalPassed / functional.length;
  const performance = benches.length === 0 ? 1 : benchResults.every((result) => result.passed) ? 1 : 0;
  const submitted = order.map((name) => files[name]).join("\n");
  const reference = referenceFiles(challenge);
  const referenceCode = reference.order.map((name) => reference.files[name]).join("\n");
  const maintainability = maintainabilityScore(submitted, referenceCode);
  const score = patchScore(correctness, performance, maintainability);
  const passedAll = results.every((result) => result.passed);
  return finish(
    challenge,
    blank({
      tests: results.map((result) => ({ name: result.name, passed: result.passed, message: result.message })),
      correctness,
      performance,
      maintainability,
      score,
      passedAll,
      executionTimeMs: Math.round(results.reduce((sum, result) => sum + result.ms, 0)),
    }),
    reveal,
    passedAll,
  );
}

function ratio(correct: number, total: number): Evaluation["correctness"] {
  return total === 0 ? 1 : correct / total;
}

export async function evaluateChallenge(challenge: Challenge, payload: Payload, reveal = false): Promise<Evaluation> {
  if (challenge.kind === "patch" || challenge.kind === "incident") {
    return evaluatePatch(challenge, payload, reveal);
  }

  if (challenge.kind === "trace") {
    const checkpoints = challenge.checkpoints ?? [];
    let correct = 0;
    const tests = checkpoints.map((checkpoint) => {
      const got = String(payload.values?.[checkpoint.id] ?? "").trim();
      const passed = got === checkpoint.answer;
      if (passed) correct += 1;
      return { name: checkpoint.prompt, passed, message: passed ? "Matched." : "Does not match." };
    });
    const score = Math.round(ratio(correct, checkpoints.length) * 100);
    return finish(challenge, blank({ tests, correctness: ratio(correct, checkpoints.length), score, passedAll: correct === checkpoints.length }), reveal, correct === checkpoints.length);
  }

  if (challenge.kind === "choice") {
    const questions = challenge.questions ?? [];
    let correct = 0;
    const tests = questions.map((question) => {
      const passed = payload.answers?.[question.id] === question.answer;
      if (passed) correct += 1;
      return { name: question.prompt, passed, message: passed ? "Correct." : "Not this one." };
    });
    const score = Math.round(ratio(correct, questions.length) * 100);
    return finish(
      challenge,
      blank({
        tests,
        correctness: ratio(correct, questions.length),
        score,
        passedAll: correct === questions.length,
        explanations: reveal
          ? questions.map((question) => ({
              id: question.id,
              correct: payload.answers?.[question.id] === question.answer,
              explanation: question.explanation,
            }))
          : null,
      }),
      reveal,
      correct === questions.length,
    );
  }

  if (challenge.kind === "review") {
    const files = Object.fromEntries((challenge.reviewFiles ?? []).map((file) => [file.name, file.content]));
    for (const finding of challenge.findings ?? []) lineOf(files[finding.file] ?? "", finding.anchor);
    const scored = scoreReview(payload.comments ?? [], challenge.findings ?? [], files);
    const passedAll = scored.f1 >= 0.75;
    return finish(
      challenge,
      blank({
        tests: [
          { name: "Precision", passed: scored.precision >= 0.5, message: scored.precision.toFixed(2) },
          { name: "Recall", passed: scored.recall >= 0.75, message: scored.recall.toFixed(2) },
        ],
        correctness: scored.f1,
        score: scored.score,
        passedAll,
        missed: reveal ? scored.missed : null,
      }),
      reveal,
      passedAll,
    );
  }

  if (challenge.kind === "spec") {
    const scored = scoreSpec(
      payload.spec ?? { title: "", summary: "", nonGoals: "", endpoints: [], entities: [], acceptance: "" },
    );
    const passedAll = scored.score >= 80;
    return finish(
      challenge,
      blank({
        tests: scored.checks.map((check) => ({ name: check.detail, passed: check.ok, message: check.ok ? `+${check.points}` : "0" })),
        correctness: scored.score / 100,
        score: scored.score,
        passedAll,
        checks: scored.checks,
      }),
      reveal,
      passedAll,
    );
  }

  if (challenge.kind === "flags") {
    const gold = (challenge.pipeline ?? []).filter((step) => step.leak).map((step) => step.id);
    const flagged = payload.flagged ?? [];
    const overlap = jaccard(flagged, gold);
    const passedAll = overlap === 1 && flagged.length === gold.length;
    const missed = gold.filter((id) => !flagged.includes(id));
    const extra = flagged.filter((id) => !gold.includes(id));
    return finish(
      challenge,
      blank({
        tests: [{ name: "Leak set", passed: passedAll, message: passedAll ? "Exact." : "The set does not match." }],
        correctness: overlap,
        score: Math.round(overlap * 100),
        passedAll,
        missed: reveal ? [...missed.map((id) => `Missing leak: ${id}`), ...extra.map((id) => `Not a leak: ${id}`)] : null,
      }),
      reveal,
      passedAll,
    );
  }

  if (challenge.kind === "governance") {
    const tools = challenge.tools ?? [];
    const gates = challenge.gates ?? [];
    const tests = [
      ...tools.map((tool) => {
        const passed = payload.tools?.[tool.id] === tool.answer;
        return { name: tool.id, passed, message: passed ? "Matches." : reveal ? `Expected ${tool.answer}.` : "Does not match." };
      }),
      ...gates.map((gate) => {
        const passed = Boolean(payload.gates?.[gate.id]) === gate.answer;
        return { name: gate.id, passed, message: passed ? "Matches." : reveal ? `Expected ${gate.answer ? "on" : "off"}.` : "Does not match." };
      }),
    ];
    const correct = tests.filter((test) => test.passed).length;
    const passedAll = correct === tests.length;
    const score = Math.round(ratio(correct, tests.length) * 100);
    return finish(challenge, blank({ tests, correctness: ratio(correct, tests.length), score, passedAll }), reveal, passedAll);
  }

  if (challenge.kind === "tradeoff") {
    const scenario = challenge.scenario;
    const options = challenge.options ?? [];
    if (!scenario) return blank({ tests: [{ name: "Scenario", passed: false, message: "Missing scenario." }] });
    const picked = options.find((option) => option.id === payload.choice);
    const tests = options.map((option) => {
      const assessment = assessOption(option, scenario);
      const selected = option.id === payload.choice;
      return {
        name: option.title,
        passed: selected && assessment.fits && option.id === challenge.correctOptionId,
        message: selected ? (assessment.fits ? "Meets the bars." : "Misses a bar.") : "Not selected.",
      };
    });
    const passedAll = picked !== undefined && picked.id === challenge.correctOptionId && assessOption(picked, scenario).fits;
    return finish(
      challenge,
      blank({
        tests,
        correctness: passedAll ? 1 : 0,
        score: passedAll ? 100 : 0,
        passedAll,
      }),
      reveal,
      passedAll,
    );
  }

  return blank({ tests: [{ name: "Unsupported", passed: false, message: challenge.kind }] });
}

export async function traceIssued(challenge: Challenge, scenarioId: string) {
  const scenario = challenge.scenarios?.find((item) => item.id === scenarioId);
  const file = challenge.files?.find((item) => item.traceSource);
  if (!scenario || !file?.traceSource) return [];
  const [result] = await runSteps(
    {},
    [],
    [{ type: "trace", name: scenario.label, source: file.traceSource, entry: scenario.entry, args: scenario.args }],
    4000,
  );
  return result?.passed ? result.data : [];
}
