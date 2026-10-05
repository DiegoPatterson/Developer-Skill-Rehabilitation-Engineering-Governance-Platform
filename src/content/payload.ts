import type { Block } from "./types";
import type { SpecInput } from "@/engine/spec";

export type GradePayload = {
  files?: Record<string, string>;
  values?: Record<string, string>;
  answers?: Record<string, string>;
  comments?: { file: string; line: number; category: string; text: string }[];
  spec?: SpecInput;
  flagged?: string[];
  tools?: Record<string, "allow" | "ask" | "deny">;
  gates?: Record<string, boolean>;
  choice?: string;
};

export type GradeEvaluation = {
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

export type GradeResponse = {
  evaluation: GradeEvaluation;
  mode: "run" | "submit";
  storedScore: number | null;
  mastered: boolean | null;
  late: boolean | null;
  hintsUsed: number;
  overallElo: number | null;
  streak: number | null;
  shields: number | null;
};
