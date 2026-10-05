import type { Category, ChallengeKind } from "@/content/types";
import type { AttemptView } from "@/content/view-model";

export type SubmissionInput = {
  userId: string;
  nodeId: string;
  kind: ChallengeKind;
  category: Category;
  difficulty: number;
  codeSubmitted: string;
  passedAll: boolean;
  performance: number;
  correctness: number;
  maintainability: number;
  executionTimeMs: number | null;
  rawScore: number;
  precision: number | null;
};

export type SubmissionResult = {
  storedScore: number;
  mastered: boolean;
  late: boolean;
  hintsUsed: number;
  overallElo: number;
  streak: number;
  shields: number;
};

export type DashboardRecent = {
  id: string;
  nodeId: string;
  title: string;
  score: number | null;
  passed: boolean;
  submittedAt: string;
  category: string;
};

export type DashboardData = {
  heatmap: { date: string; count: number }[];
  elos: { category: string; elo: number; rated: boolean }[];
  medianTimeToFixMs: number | null;
  meanReviewPrecision: number | null;
  recent: DashboardRecent[];
  solved: number;
};

export interface ProgressStore {
  masteredIds(userId: string): Promise<Set<string>>;
  openAttempt(userId: string, nodeId: string): Promise<AttemptView>;
  resetAttempt(userId: string, nodeId: string): Promise<AttemptView>;
  revealHint(userId: string, nodeId: string): Promise<{ hints: string[]; hintsUsed: number; hintCount: number }>;
  recordSubmission(input: SubmissionInput): Promise<SubmissionResult>;
  dashboard(userId: string): Promise<DashboardData>;
}
