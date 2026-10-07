import type { Category, ChallengeKind } from "@/content/types";

export function ratedCategories(kind: ChallengeKind, category: Category): Category[] {
  if (kind === "incident") return ["debugging", "security"];
  return [category];
}

/** Learning paths are optional. A lesson never stays closed because a prerequisite is open. */
export function isLocked(kind: ChallengeKind, prereqs: string[], mastered: ReadonlySet<string>): boolean {
  void kind;
  void prereqs;
  void mastered;
  return false;
}

export function decideOutcome(input: {
  kind: ChallengeKind;
  rawScore: number;
  passedAll: boolean;
  performance: number;
  hintsUsed: number;
  late: boolean;
}): { storedScore: number; mastered: boolean } {
  const penalized =
    input.kind === "patch" || input.kind === "incident"
      ? Math.max(0, input.rawScore - 6 * input.hintsUsed)
      : input.rawScore;
  const storedScore = input.late ? Math.min(penalized, 60) : penalized;
  if (input.late) return { storedScore, mastered: false };
  if (input.kind === "patch" || input.kind === "incident") {
    return {
      storedScore,
      mastered: input.passedAll && input.performance === 1 && storedScore >= 70,
    };
  }
  return { storedScore, mastered: input.passedAll };
}
