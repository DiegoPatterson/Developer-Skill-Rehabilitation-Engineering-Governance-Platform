import { describe, expect, it } from "vitest";
import { assessOption } from "@/engine/cost";
import { lineOf } from "@/engine/review";
import { assertCatalog, challenges } from "@/content/catalog";
import { evaluateChallenge, submittedFiles } from "@/content/evaluate";
import { toPublic } from "@/content/public";

function stripSnaps(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.includes("__snap("))
    .join("\n")
    .trim();
}

describe("catalog", () => {
  it("is a prerequisite DAG with a public view that hides reference solutions", () => {
    assertCatalog();
    const numbers = challenges.map((challenge) => challenge.number).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(challenges.length);
    expect(numbers[0]).toBe(1);
    for (const challenge of challenges) {
      const pub = JSON.stringify(toPublic(challenge));
      expect(pub).not.toContain("REFERENCE_SOLUTION");
      expect(pub).not.toContain("traceSource");
      for (const file of challenge.files ?? []) {
        if (!file.traceSource) continue;
        expect(stripSnaps(file.traceSource)).toBe(file.starter.trim());
      }
      for (const finding of challenge.findings ?? []) {
        const source = challenge.reviewFiles?.find((file) => file.name === finding.file)?.content ?? "";
        expect(lineOf(source, finding.anchor)).toBeGreaterThan(0);
      }
    }
  });

  it("has one tradeoff option that meets every bar", () => {
    const cost = challenges.find((challenge) => challenge.id === "ml-cost");
    expect(cost?.scenario).toBeTruthy();
    const fitting = (cost?.options ?? []).filter((option) => assessOption(option, cost!.scenario!).fits);
    expect(fitting.map((option) => option.id)).toEqual([cost?.correctOptionId]);
  });

  it("accepts every reference patch and rejects every issued starter", async () => {
    const executable = challenges.filter((challenge) => challenge.kind === "patch" || challenge.kind === "incident");
    for (const challenge of executable) {
      const solution: Record<string, string> = {};
      const starter: Record<string, string> = {};
      for (const file of challenge.files ?? []) {
        solution[file.name] = file.solution;
        starter[file.name] = file.starter;
      }
      const good = await evaluateChallenge(challenge, { files: solution });
      const bad = await evaluateChallenge(challenge, { files: starter });
      expect(good.passedAll, `${challenge.id} reference failed: ${good.tests.filter((test) => !test.passed).map((test) => `${test.name}: ${test.message}`).join(" | ")}`).toBe(true);
      expect(good.score).toBeGreaterThanOrEqual(70);
      expect(bad.passedAll, `${challenge.id} starter unexpectedly passed`).toBe(false);
      expect(submittedFiles(challenge, solution).order.length).toBe(challenge.files?.length);
    }
  }, 120000);
});
