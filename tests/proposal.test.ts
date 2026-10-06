import { describe, expect, it } from "vitest";
import { toPublic } from "@/content/public";
import {
  challengesFromApproved,
  nextLessonNumber,
  parseProposal,
  publishedLessons,
  resolvePrereqNumbers,
  toChallenge,
} from "@/content/proposal";
import { canReview, signInBlock } from "@/content/roles";

const patch = {
  label: "Adds",
  title: "Add the numbers",
  description: "The starter returns the first argument and ignores the second.",
  category: "debugging",
  kind: "patch",
  difficulty: 1,
  showInGraph: true,
  prereqNumbers: [1],
  signature: "function add(left, right)",
  constraints: [],
  hints: [],
  debrief: "Add both arguments.",
  patch: {
    fileName: "add.js",
    starter: "function add(left, right) {\n  return left;\n}\n",
    solution: "function add(left, right) {\n  return left + right;\n}\n",
    tests: [{ name: "one plus two", entry: "add", argsText: "[1, 2]", mode: "returns", expectText: "3", messageIncludes: "" }],
  },
};

describe("roles", () => {
  it("blocks a banned or inactive account and lets admins review", () => {
    expect(signInBlock("active", "banned")).toBe("This account is banned.");
    expect(signInBlock("inactive", "user")).toBe("This account is inactive.");
    expect(signInBlock("active", "user")).toBeNull();
    expect(canReview("owner")).toBe(true);
    expect(canReview("admin")).toBe(true);
    expect(canReview("superuser")).toBe(false);
    expect(canReview("user")).toBe(false);
  });
});

describe("proposals", () => {
  it("assigns the next lesson number and hides the reference solution", () => {
    expect(nextLessonNumber([1, 20])).toBe(21);
    expect(nextLessonNumber([21, 4])).toBe(22);
    const parsed = parseProposal(patch);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const published = publishedLessons([]);
    const resolved = resolvePrereqNumbers(parsed.draft.prereqNumbers, published);
    expect(resolved).toEqual({ ids: ["dbg-state-basics"] });
    if (!("ids" in resolved)) return;
    const challenge = toChallenge(parsed.draft, 21, "community-21", resolved.ids);
    const pub = toPublic(challenge);
    expect(pub.number).toBe(21);
    expect(pub.label).toBe("Adds");
    expect(pub.files[0]?.starter).toContain("return left");
    expect(JSON.stringify(pub)).not.toContain("left + right");
    expect(challenge.files?.[0]?.solution).toContain("left + right");
  });

  it("rejects a starter that already matches the solution and an unknown prerequisite", () => {
    const same = parseProposal({
      ...patch,
      patch: { ...patch.patch, solution: patch.patch.starter },
    });
    expect(same.ok).toBe(false);
    const published = publishedLessons([]);
    expect(resolvePrereqNumbers([99], published)).toEqual({ error: "Lesson #99 is not published yet." });
  });

  it("publishes an accepted draft after earlier community lessons", () => {
    const first = parseProposal({ ...patch, prereqNumbers: [] });
    const second = parseProposal({ ...patch, title: "Add three numbers", prereqNumbers: [21] });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const built = challengesFromApproved([
      { payload: second.draft, lessonNumber: 22, nodeId: "community-22" },
      { payload: first.draft, lessonNumber: 21, nodeId: "community-21" },
    ]);
    expect(built.map((challenge) => challenge.number)).toEqual([21, 22]);
    expect(built[1]?.prereqs).toEqual(["community-21"]);
  });

  it("requires the marked tradeoff to be the only one that fits", () => {
    const common = {
      label: "Cost",
      title: "Pick the cheaper fit",
      description: "One option meets the latency, the budget, and the accuracy bar.",
      category: "ml",
      kind: "tradeoff",
      difficulty: 2,
      showInGraph: true,
      prereqNumbers: [],
      signature: "",
      constraints: [],
      hints: [],
      debrief: "",
    };
    const options = [
      {
        title: "Rules",
        kind: "heuristic",
        inputPricePerMillion: 0,
        outputPricePerMillion: 0,
        instances: 0,
        hourly: 0,
        latencyMs: 20,
        accuracy: 0.95,
        note: "",
      },
      {
        title: "Hosted",
        kind: "api",
        inputPricePerMillion: 30,
        outputPricePerMillion: 60,
        instances: 0,
        hourly: 0,
        latencyMs: 900,
        accuracy: 0.99,
        note: "",
      },
    ];
    const bars = {
      requestsPerDay: 1000,
      inputTokens: 800,
      outputTokens: 120,
      latencyBudgetMs: 400,
      monthlyBudget: 50,
      accuracyBar: 0.9,
    };
    expect(parseProposal({ ...common, tradeoff: { ...bars, options, correct: 0 } }).ok).toBe(true);
    expect(parseProposal({ ...common, tradeoff: { ...bars, options, correct: 1 } }).ok).toBe(false);
  });
});
