import { challenges } from "@/content/catalog";
import { parsePathProposal } from "@/content/path-proposal";
import { LESSON_PATHS, formatPathDifficulty, formatProblemCount, isLearningPathId, lessonPath, orderFavoritedFirst, pathForLesson, pathTopics } from "@/content/paths";
import { describe, expect, it } from "vitest";

describe("lesson paths", () => {
  it("covers lessons 1 through 19 once and leaves the outage off every path", () => {
    const steps = LESSON_PATHS.flatMap((path) => path.steps);
    expect(new Set(steps).size).toBe(steps.length);
    expect([...steps].sort((a, b) => a - b)).toEqual(Array.from({ length: 19 }, (_, index) => index + 1));
    expect(steps).not.toContain(20);
    const numbers = new Set(challenges.map((challenge) => challenge.number));
    for (const step of steps) expect(numbers.has(step)).toBe(true);
  });

  it("keeps each path id unique and falls back to the first path", () => {
    expect(new Set(LESSON_PATHS.map((path) => path.id)).size).toBe(LESSON_PATHS.length);
    expect(lessonPath("missing").id).toBe(LESSON_PATHS[0].id);
    expect(pathForLesson(12)?.id).toBe("reading");
    expect(pathForLesson(20)).toBeUndefined();
    expect(pathForLesson(21)).toBeUndefined();
  });

  it("names every path a lesson sits on, including an accepted one", () => {
    expect(pathTopics(12, [])).toEqual(["Reading code"]);
    expect(pathTopics(12, [{ topic: "Refunds", steps: [12, 4] }])).toEqual(["Reading code", "Refunds"]);
    expect(pathTopics(12, [{ topic: "Reading code", steps: [12] }])).toEqual(["Reading code"]);
    expect(pathTopics(21, [{ topic: "Community", steps: [21] }])).toEqual(["Community"]);
  });

  it("keeps newest favorites first and leaves the rest in catalog order", () => {
    const paths = [{ id: "debugging" }, { id: "reading" }, { id: "systems" }];
    expect(orderFavoritedFirst(paths, ["systems", "debugging", "systems"]).map((path) => path.id)).toEqual(["systems", "debugging", "reading"]);
    expect(orderFavoritedFirst(paths, ["missing"])).toEqual(paths);
  });

  it("accepts a built-in path id or a proposal id", () => {
    expect(isLearningPathId("debugging")).toBe(true);
    expect(isLearningPathId("not-a-path")).toBe(false);
    expect(isLearningPathId("11111111-1111-1111-1111-111111111111")).toBe(true);
  });

  it("describes a path by its problem count and lesson difficulties", () => {
    expect(formatProblemCount(1)).toBe("1 problem");
    expect(formatProblemCount(3)).toBe("3 problems");
    expect(formatPathDifficulty([])).toBe("—");
    expect(formatPathDifficulty([3, 3])).toBe("3");
    expect(formatPathDifficulty([1, 5, 2])).toBe("1–5");
  });
});

describe("path proposals", () => {
  const active = new Set([1, 4, 8]);

  it("keeps the chosen order when every lesson is active", () => {
    const parsed = parsePathProposal(
      { topic: "  Warm start ", description: "  A short path for the first bugs. ", lessonNumbers: [8, 1] },
      active,
    );
    expect(parsed).toEqual({
      ok: true,
      draft: { topic: "Warm start", description: "A short path for the first bugs.", lessonNumbers: [8, 1] },
    });
  });

  it("rejects a duplicate, a missing lesson, and an empty path", () => {
    expect(parsePathProposal({ topic: "Warm start", description: "A short path for the first bugs.", lessonNumbers: [1, 1] }, active)).toEqual({
      ok: false,
      error: "List each lesson once.",
    });
    expect(parsePathProposal({ topic: "Warm start", description: "A short path for the first bugs.", lessonNumbers: [20] }, active)).toEqual({
      ok: false,
      error: "Lesson #20 is not in the catalog.",
    });
    expect(parsePathProposal({ topic: "Warm start", description: "A short path for the first bugs.", lessonNumbers: [] }, active).ok).toBe(false);
  });
});
