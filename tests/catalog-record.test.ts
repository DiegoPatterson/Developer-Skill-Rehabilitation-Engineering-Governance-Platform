import { challenges } from "../src/content/catalog";
import { challengeFromRow, type CatalogRow } from "../src/content/catalog-record";
import { listChallenges, replaceLiveChallenges } from "../src/content/published";
import type { Challenge } from "../src/content/types";
import { afterEach, describe, expect, it } from "vitest";

function row(overrides: Partial<CatalogRow> = {}): CatalogRow {
  return {
    id: "community-21",
    title: "Saved title",
    category: "debugging",
    prerequisiteNodeIds: ["dbg-state-basics"],
    difficultyLevel: 2,
    summary: "Saved summary",
    showInGraph: false,
    lessonNumber: 21,
    kind: "patch",
    label: "queues",
    active: true,
    positionX: null,
    positionY: null,
    payload: {
      id: "stale",
      number: 1,
      title: "Payload title",
      category: "ml",
      difficulty: 5,
      summary: "Payload summary",
      showInGraph: true,
      prereqs: [],
      x: 400,
      y: 200,
      kind: "patch",
      brief: [{ type: "p", text: "Do the thing." }],
      constraints: [],
      signature: "function f()",
      hints: [],
      debrief: [],
      files: [{ name: "a.js", starter: "start", solution: "secret" }],
    },
    ...overrides,
  };
}

describe("catalog rows", () => {
  afterEach(() => replaceLiveChallenges(null));

  it("uses the database fields and keeps the answer in the payload", () => {
    const challenge = challengeFromRow(row());
    expect(challenge?.title).toBe("Saved title");
    expect(challenge?.number).toBe(21);
    expect(challenge?.showInGraph).toBe(false);
    expect(challenge?.placed).toBe(false);
    expect(challenge?.x).toBe(0);
    expect(challenge?.prereqs).toEqual(["dbg-state-basics"]);
    expect(challenge?.files?.[0]?.solution).toBe("secret");
  });

  it("keeps an admin position", () => {
    const challenge = challengeFromRow(row({ positionX: 12, positionY: 48, showInGraph: true }));
    expect(challenge?.placed).toBe(true);
    expect(challenge?.x).toBe(12);
    expect(challenge?.y).toBe(48);
  });

  it("hides inactive lessons and lessons with no payload", () => {
    expect(challengeFromRow(row({ active: false }))).toBeNull();
    expect(challengeFromRow(row({ payload: null }))).toBeNull();
  });

  it("serves the database list once it has been loaded", () => {
    expect(listChallenges()).toHaveLength(challenges.length);
    const only = challengeFromRow(row()) as Challenge;
    replaceLiveChallenges([only]);
    expect(listChallenges().map((item) => item.id)).toEqual(["community-21"]);
    replaceLiveChallenges(null);
    expect(listChallenges()).toHaveLength(challenges.length);
  });
});
