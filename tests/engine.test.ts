import { describe, expect, it } from "vitest";
import { assessOption } from "@/engine/cost";
import { buildCfg } from "@/engine/cfg";
import { expectedScore, nextElo } from "@/engine/elo";
import { maintainabilityScore } from "@/engine/maintainability";
import { scoreReview } from "@/engine/review";
import { patchScore } from "@/engine/score";
import { scoreSpec } from "@/engine/spec";
import { applyActivity } from "@/engine/streak";

describe("elo", () => {
  it("moves a tied rating by half of K when the result is a win", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5);
    expect(nextElo(1200, 1200, 1, 24)).toBe(1212);
    expect(nextElo(1200, 1200, 0, 24)).toBe(1188);
  });
});

describe("streak", () => {
  it("counts a day, spends a shield for one missed day, and resets when shields cannot cover the gap", () => {
    const first = applyActivity(
      { currentStreak: 0, longestStreak: 0, lastActiveDate: null, streakFreezesLeft: 2 },
      "2026-10-01",
    );
    expect(first.currentStreak).toBe(1);
    const next = applyActivity(first, "2026-10-02");
    expect(next.currentStreak).toBe(2);
    expect(applyActivity(next, "2026-10-02").alreadyCounted).toBe(true);
    const shielded = applyActivity(next, "2026-10-04");
    expect(shielded.shieldsUsed).toBe(1);
    expect(shielded.currentStreak).toBe(3);
    expect(shielded.streakFreezesLeft).toBe(1);
    const reset = applyActivity(
      { currentStreak: 3, longestStreak: 3, lastActiveDate: "2026-10-01", streakFreezesLeft: 1 },
      "2026-10-06",
    );
    expect(reset.currentStreak).toBe(1);
    expect(reset.streakFreezesLeft).toBe(1);
  });

  it("earns a shield on day 7 and stops at three", () => {
    const earned = applyActivity(
      { currentStreak: 6, longestStreak: 6, lastActiveDate: "2026-10-06", streakFreezesLeft: 2 },
      "2026-10-07",
    );
    expect(earned.currentStreak).toBe(7);
    expect(earned.shieldEarned).toBe(true);
    expect(earned.streakFreezesLeft).toBe(3);
  });
});

describe("scoring helpers", () => {
  it("weights a correct, fast, readable patch at 100", () => {
    expect(patchScore(1, 1, 1)).toBe(100);
    expect(patchScore(1, 0, 1)).toBe(85);
  });

  it("penalizes eval and does not penalize the reference against itself", () => {
    const reference = "function f() {\n  return 1;\n}\n";
    expect(maintainabilityScore(reference, reference)).toBe(1);
    expect(maintainabilityScore("function f(){ return eval('1'); }", reference)).toBeLessThan(0.6);
  });

  it("scores a spec that names the flag contract", () => {
    const good = scoreSpec({
      title: "Flags",
      summary: "A mobile client asks which boolean flags are on for the signed-in user.",
      nonGoals: "No user administration and no flag editing.",
      endpoints: [
        {
          method: "GET",
          path: "/flags/evaluate",
          auth: "bearer token",
          errors: "400 when the key is missing, 401 when the token is missing",
          request: "flag key",
          response: "boolean and default",
        },
      ],
      entities: [
        { name: "Flag", fields: "key, default" },
        { name: "SegmentRule", fields: "condition" },
      ],
      acceptance: "A missing flag returns the default.",
    });
    expect(good.score).toBeGreaterThanOrEqual(80);
    const creep = scoreSpec({
      ...{
        title: "Flags",
        summary: "A mobile client asks which boolean flags are on for the signed-in user.",
        nonGoals: "No user administration and no flag editing.",
        endpoints: [
          {
            method: "GET",
            path: "/flags/evaluate",
            auth: "bearer token",
            errors: "400 and 401",
            request: "flag key",
            response: "boolean",
          },
          { method: "DELETE", path: "/users", auth: "bearer", errors: "401", request: "", response: "" },
        ],
        entities: [
          { name: "Flag", fields: "key, default" },
          { name: "SegmentRule", fields: "condition" },
        ],
        acceptance: "A missing flag returns the default.",
      },
    });
    expect(creep.score).toBe(good.score - 20);
  });

  it("matches a review comment near the anchor", () => {
    const files = { "a.js": "function f() {\n  const current = read();\n  write(current + 1);\n}\n" };
    const scored = scoreReview(
      [{ file: "a.js", line: 3, category: "race", text: "This write uses a stale read." }],
      [{ file: "a.js", anchor: "write(current + 1)", category: "race", tolerance: 3, summary: "lost update" }],
      files,
    );
    expect(scored.f1).toBe(1);
  });
});

describe("control flow", () => {
  it("marks the statement after a return unreachable", () => {
    const graph = buildCfg(`function route(req) {
      if (!req) {
        return "drop";
        req.logged = true;
      }
      return "allow";
    }`);
    expect(graph.nodes.some((node) => node.unreachable && node.label.includes("logged"))).toBe(true);
    expect(graph.edges.some((edge) => edge.label === "true" || edge.label === "false")).toBe(true);
  });
});

describe("cost", () => {
  it("keeps only the small CPU classifier inside the bars", () => {
    const scenario = {
      requestsPerDay: 2_000_000,
      inputTokens: 800,
      outputTokens: 120,
      latencyBudgetMs: 400,
      monthlyBudget: 4000,
      accuracyBar: 0.97,
    };
    const frontier = assessOption(
      { id: "frontier", title: "Frontier", kind: "api", inputPricePerMillion: 3, outputPricePerMillion: 15, latencyMs: 900, accuracy: 0.992, note: "" },
      scenario,
    );
    expect(frontier.cost).toBeCloseTo(252000);
    expect(frontier.fits).toBe(false);
    const distilled = assessOption(
      { id: "distilled", title: "Small", kind: "instance", instances: 2, hourly: 0.15, latencyMs: 180, accuracy: 0.985, note: "" },
      scenario,
    );
    expect(distilled.cost).toBeCloseTo(219);
    expect(distilled.fits).toBe(true);
  });
});
