import { describe, expect, it } from "vitest";
import { bestPerUser, newestFirst, presentSubmission, type AttemptRecord } from "@/content/submissions";

function row(patch: Partial<AttemptRecord> & Pick<AttemptRecord, "id" | "userId">): AttemptRecord {
  return {
    username: patch.userId,
    passed: true,
    score: 80,
    executionTimeMs: 20,
    timeToFixMs: 1000,
    hintsUsed: 0,
    submittedAt: "2026-10-06T12:00:00.000Z",
    ...patch,
  };
}

describe("submission order", () => {
  it("keeps one passing attempt per person and puts the strongest first", () => {
    const ranked = bestPerUser([
      row({ id: "late-weak", userId: "ada", score: 70, submittedAt: "2026-10-06T18:00:00.000Z" }),
      row({ id: "ada-best", userId: "ada", score: 90, executionTimeMs: 40, submittedAt: "2026-10-06T11:00:00.000Z" }),
      row({ id: "ada-fail", userId: "ada", passed: false, score: 100, submittedAt: "2026-10-06T19:00:00.000Z" }),
      row({ id: "bea-fast", userId: "bea", score: 90, executionTimeMs: 10 }),
      row({ id: "cy-hints", userId: "cy", score: 90, executionTimeMs: 40, hintsUsed: 2 }),
      row({ id: "cy-clean", userId: "cy", score: 90, executionTimeMs: 40, hintsUsed: 0, submittedAt: "2026-10-06T13:00:00.000Z" }),
      row({ id: "no-pass", userId: "dee", passed: false, score: 99 }),
    ]);
    expect(ranked.map((item) => item.id)).toEqual(["bea-fast", "ada-best", "cy-clean"]);
  });

  it("breaks a full tie by the earlier submission", () => {
    const ranked = bestPerUser([
      row({ id: "later", userId: "ada", submittedAt: "2026-10-06T15:00:00.000Z" }),
      row({ id: "earlier", userId: "bea", submittedAt: "2026-10-06T10:00:00.000Z" }),
    ]);
    expect(ranked.map((item) => item.id)).toEqual(["earlier", "later"]);
  });

  it("lists your attempts newest first, including failures", () => {
    const history = newestFirst([
      row({ id: "old", userId: "ada", submittedAt: "2026-10-06T10:00:00.000Z" }),
      row({ id: "new-fail", userId: "ada", passed: false, submittedAt: "2026-10-06T16:00:00.000Z" }),
      row({ id: "mid", userId: "ada", submittedAt: "2026-10-06T12:00:00.000Z" }),
    ]);
    expect(history.map((item) => item.id)).toEqual(["new-fail", "mid", "old"]);
  });
});

describe("presentSubmission", () => {
  it("reads files and answers out of a stored grade body", () => {
    const shown = presentSubmission(
      JSON.stringify({
        nodeId: "dbg-state-basics",
        mode: "submit",
        files: { "ledger.js": "return a;" },
        choice: "hash",
        values: { step: "3" },
      }),
    );
    expect(shown.files).toEqual([{ name: "ledger.js", text: "return a;" }]);
    expect(shown.notes.map((note) => note.label)).toEqual(["Trace", "Choice"]);
  });

  it("keeps plain text when the stored body is not JSON", () => {
    expect(presentSubmission("not json").notes).toEqual([{ label: "Submission", text: "not json" }]);
  });
});
