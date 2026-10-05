import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { hintText } from "@/content/public";
import { createSource } from "@/content/source";
import type { AttemptView } from "@/content/view-model";
import type { Category } from "@/content/types";
import { dateFromYmd, localToday, ymdFromDate } from "@/engine/dates";
import { challengeRating, nextElo, overallElo } from "@/engine/elo";
import { buildHeatmap, median } from "@/engine/heatmap";
import { applyActivity } from "@/engine/streak";
import { ensureCatalog, getDb } from "@/server/db";
import { decideOutcome, ratedCategories } from "@/server/outcome";
import type { DashboardData, ProgressStore, SubmissionInput, SubmissionResult } from "./types";

function challengeOrThrow(nodeId: string) {
  const challenge = createSource().get(nodeId);
  if (!challenge) throw new Error("Unknown challenge.");
  return challenge;
}

function toAttempt(row: { id: string; startedAt: Date; deadlineAt: Date | null; hintsUsed: number }, hints: string[]): AttemptView {
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    deadlineAt: row.deadlineAt ? row.deadlineAt.toISOString() : null,
    hintsUsed: row.hintsUsed,
    hints,
  };
}

function readPrecision(value: Prisma.JsonValue): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("precision" in value)) return null;
  const precision = value.precision;
  return typeof precision === "number" && Number.isFinite(precision) ? precision : null;
}

export class PrismaProgressStore implements ProgressStore {
  private async db() {
    await ensureCatalog();
    return getDb();
  }

  async masteredIds(userId: string): Promise<Set<string>> {
    const db = await this.db();
    const rows = await db.userNodeProgress.findMany({
      where: { userId, status: "mastered" },
      select: { nodeId: true },
    });
    return new Set(rows.map((row) => row.nodeId));
  }

  async openAttempt(userId: string, nodeId: string): Promise<AttemptView> {
    const challenge = challengeOrThrow(nodeId);
    const db = await this.db();
    const existing = await db.challengeAttempt.findFirst({
      where: { userId, nodeId, closedAt: null },
      orderBy: { startedAt: "desc" },
    });
    const row =
      existing ??
      (await db.challengeAttempt.create({
        data: {
          userId,
          nodeId,
          mode: challenge.kind,
          deadlineAt: challenge.timeLimitMinutes ? new Date(Date.now() + challenge.timeLimitMinutes * 60_000) : null,
        },
      }));
    return toAttempt(row, hintText(challenge, row.hintsUsed));
  }

  async resetAttempt(userId: string, nodeId: string): Promise<AttemptView> {
    const challenge = challengeOrThrow(nodeId);
    if (challenge.kind !== "incident") throw new Error("Only an incident can be restarted.");
    const db = await this.db();
    await db.challengeAttempt.updateMany({
      where: { userId, nodeId, closedAt: null },
      data: { closedAt: new Date() },
    });
    const row = await db.challengeAttempt.create({
      data: {
        userId,
        nodeId,
        mode: challenge.kind,
        deadlineAt: new Date(Date.now() + (challenge.timeLimitMinutes ?? 15) * 60_000),
      },
    });
    return toAttempt(row, []);
  }

  async revealHint(userId: string, nodeId: string): Promise<{ hints: string[]; hintsUsed: number; hintCount: number }> {
    const challenge = challengeOrThrow(nodeId);
    const current = await this.openAttempt(userId, nodeId);
    if (current.hintsUsed >= challenge.hints.length) {
      return { hints: current.hints, hintsUsed: current.hintsUsed, hintCount: challenge.hints.length };
    }
    const db = await this.db();
    const updated = await db.challengeAttempt.update({
      where: { id: current.id },
      data: { hintsUsed: { increment: 1 } },
    });
    return {
      hints: hintText(challenge, updated.hintsUsed),
      hintsUsed: updated.hintsUsed,
      hintCount: challenge.hints.length,
    };
  }

  async recordSubmission(input: SubmissionInput): Promise<SubmissionResult> {
    const db = await this.db();
    return db.$transaction(async (tx) => {
      let attempt = await tx.challengeAttempt.findFirst({
        where: { userId: input.userId, nodeId: input.nodeId, closedAt: null },
        orderBy: { startedAt: "desc" },
      });
      if (!attempt) {
        attempt = await tx.challengeAttempt.create({
          data: { userId: input.userId, nodeId: input.nodeId, mode: input.kind },
        });
      }
      const late = Boolean(attempt.deadlineAt && attempt.deadlineAt.getTime() < Date.now());
      const { storedScore, mastered } = decideOutcome({
        kind: input.kind,
        rawScore: input.rawScore,
        passedAll: input.passedAll,
        performance: input.performance,
        hintsUsed: attempt.hintsUsed,
        late,
      });
      const existing = await tx.userNodeProgress.findUnique({
        where: { userId_nodeId: { userId: input.userId, nodeId: input.nodeId } },
      });
      const already = existing?.status === "mastered";
      const k = already ? 0 : 24;
      const stats = await tx.userStats.findUnique({ where: { userId: input.userId } });
      if (!stats) throw new Error("Account is missing stats.");
      const ratings: Record<Category, number> = {
        debugging: stats.debuggingElo,
        security: stats.securityElo,
        comprehension: stats.comprehensionElo,
        performance: stats.performanceElo,
        architecture: stats.architectureElo,
        ml: stats.mlElo,
      };
      const opponent = challengeRating(input.difficulty);
      for (const category of ratedCategories(input.kind, input.category)) {
        ratings[category] = nextElo(ratings[category], opponent, storedScore / 100, k);
      }
      const nextOverall = overallElo(Object.values(ratings));
      const timeToFixMs = Math.min(2_147_483_647, Math.max(0, Date.now() - attempt.startedAt.getTime()));
      const breakdown: Prisma.InputJsonValue = {
        correctness: input.correctness,
        performance: input.performance,
        maintainability: input.maintainability,
        rawScore: input.rawScore,
        storedScore,
        late,
        mastered,
        hintsUsed: attempt.hintsUsed,
        ...(input.precision == null ? {} : { precision: input.precision }),
      };
      await tx.challengeSubmission.create({
        data: {
          userId: input.userId,
          nodeId: input.nodeId,
          codeSubmitted: input.codeSubmitted,
          passedAllTests: input.passedAll,
          executionTimeMs: input.executionTimeMs,
          optimalPatchScore: storedScore,
          timeToFixMs,
          category: input.category,
          hintsUsed: attempt.hintsUsed,
          breakdown,
        },
      });
      await tx.userNodeProgress.upsert({
        where: { userId_nodeId: { userId: input.userId, nodeId: input.nodeId } },
        create: {
          userId: input.userId,
          nodeId: input.nodeId,
          status: mastered ? "mastered" : "in_progress",
          completedAt: mastered ? new Date() : null,
          bestScore: storedScore,
          attempts: 1,
        },
        update: {
          status: mastered || already ? "mastered" : "in_progress",
          completedAt: already ? existing?.completedAt : mastered ? new Date() : existing?.completedAt,
          bestScore: Math.max(existing?.bestScore ?? 0, storedScore),
          attempts: { increment: 1 },
        },
      });
      await tx.userStats.update({
        where: { userId: input.userId },
        data: {
          debuggingElo: ratings.debugging,
          securityElo: ratings.security,
          comprehensionElo: ratings.comprehension,
          performanceElo: ratings.performance,
          architectureElo: ratings.architecture,
          mlElo: ratings.ml,
          overallElo: nextOverall,
          totalChallengesSolved: mastered && !already ? { increment: 1 } : undefined,
        },
      });
      const streakRow = await tx.userStreak.findUnique({ where: { userId: input.userId } });
      const today = localToday();
      const streak = applyActivity(
        {
          currentStreak: streakRow?.currentStreak ?? 0,
          longestStreak: streakRow?.longestStreak ?? 0,
          lastActiveDate: streakRow?.lastActiveDate ? ymdFromDate(streakRow.lastActiveDate) : null,
          streakFreezesLeft: streakRow?.streakFreezesLeft ?? 2,
        },
        today,
      );
      await tx.userStreak.update({
        where: { userId: input.userId },
        data: {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          lastActiveDate: dateFromYmd(streak.lastActiveDate ?? today),
          streakFreezesLeft: streak.streakFreezesLeft,
        },
      });
      if (mastered) {
        await tx.challengeAttempt.update({ where: { id: attempt.id }, data: { closedAt: new Date() } });
      }
      return {
        storedScore,
        mastered,
        late,
        hintsUsed: attempt.hintsUsed,
        overallElo: nextOverall,
        streak: streak.currentStreak,
        shields: streak.streakFreezesLeft,
      };
    });
  }

  async dashboard(userId: string): Promise<DashboardData> {
    const db = await this.db();
    const [stats, recentRows, passes, heatRows] = await Promise.all([
      db.userStats.findUnique({ where: { userId } }),
      db.challengeSubmission.findMany({
        where: { userId },
        orderBy: { submittedAt: "desc" },
        take: 200,
        include: { node: { select: { title: true } } },
      }),
      db.challengeSubmission.findMany({
        where: { userId, passedAllTests: true, timeToFixMs: { not: null } },
        orderBy: { submittedAt: "desc" },
        take: 20,
        select: { timeToFixMs: true },
      }),
      db.challengeSubmission.findMany({
        where: { userId, submittedAt: { gte: new Date(Date.now() - 130 * 86_400_000) } },
        select: { submittedAt: true },
      }),
    ]);
    const precisions = recentRows.map((row) => readPrecision(row.breakdown)).filter((value): value is number => value != null);
    const elos = [
      ["debugging", stats?.debuggingElo ?? 1200],
      ["security", stats?.securityElo ?? 1200],
      ["comprehension", stats?.comprehensionElo ?? 1200],
      ["performance", stats?.performanceElo ?? 1200],
      ["architecture", stats?.architectureElo ?? 1200],
      ["ml", stats?.mlElo ?? 1200],
    ] as const;
    return {
      heatmap: buildHeatmap(heatRows.map((row) => localToday(row.submittedAt))),
      elos: elos.map(([category, elo]) => ({ category, elo })),
      medianTimeToFixMs: median(passes.map((row) => row.timeToFixMs ?? 0)),
      meanReviewPrecision: precisions.length ? precisions.reduce((sum, value) => sum + value, 0) / precisions.length : null,
      recent: recentRows.slice(0, 8).map((row) => ({
        id: row.id,
        nodeId: row.nodeId,
        title: row.node.title,
        score: row.optimalPatchScore,
        passed: row.passedAllTests,
        submittedAt: row.submittedAt.toISOString(),
        category: row.category,
      })),
      solved: stats?.totalChallengesSolved ?? 0,
    };
  }
}
