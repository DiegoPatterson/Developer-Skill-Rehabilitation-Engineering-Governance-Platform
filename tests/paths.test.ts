import { challenges } from "@/content/catalog";
import { LESSON_PATHS, lessonPath, pathForLesson } from "@/content/paths";
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
});
