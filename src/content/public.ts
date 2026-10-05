import type { Challenge, PublicChallenge } from "./types";

export function toPublic(challenge: Challenge): PublicChallenge {
  return {
    id: challenge.id,
    title: challenge.title,
    category: challenge.category,
    difficulty: challenge.difficulty,
    summary: challenge.summary,
    kind: challenge.kind,
    timeLimitMinutes: challenge.timeLimitMinutes,
    brief: challenge.brief,
    constraints: challenge.constraints,
    signature: challenge.signature,
    hintCount: challenge.hints.length,
    files: (challenge.files ?? []).map((file) => ({ name: file.name, starter: file.starter })),
    tests: (challenge.steps ?? []).map((step) => ({ name: String(step.name) })),
    scenarios: (challenge.scenarios ?? []).map((scenario) => ({
      id: scenario.id,
      label: scenario.label,
      argsPreview: scenario.argsPreview,
    })),
    questions: (challenge.questions ?? []).map((question) => ({
      id: question.id,
      prompt: question.prompt,
      code: question.code,
      options: question.options,
    })),
    checkpoints: (challenge.checkpoints ?? []).map((checkpoint) => ({
      id: checkpoint.id,
      prompt: checkpoint.prompt,
    })),
    traceCode: challenge.traceCode,
    reviewFiles: challenge.reviewFiles ?? [],
    categories: challenge.categories ?? [],
    pipeline: (challenge.pipeline ?? []).map((step) => ({ id: step.id, text: step.text })),
    tools: (challenge.tools ?? []).map((tool) => ({ id: tool.id, description: tool.description })),
    gates: (challenge.gates ?? []).map((gate) => ({ id: gate.id, description: gate.description })),
    showCfg: Boolean(challenge.cfgSource),
  };
}

export function hintText(challenge: Challenge, count: number): string[] {
  return challenge.hints.slice(0, Math.max(0, count));
}
