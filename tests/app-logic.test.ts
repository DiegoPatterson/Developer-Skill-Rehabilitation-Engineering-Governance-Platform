import { describe, expect, it } from "vitest";
import { buildHeatmap, median } from "@/engine/heatmap";
import { FirestoreStore } from "@/server/store/firestore-store";
import { decideOutcome, isLocked } from "@/server/outcome";
import { verificationMessage } from "@/server/verification-message";

describe("outcome", () => {
  it("masters a clean patch and withholds mastery when hints or a late submit cut the score", () => {
    expect(decideOutcome({ kind: "patch", rawScore: 80, passedAll: true, performance: 1, hintsUsed: 0, late: false })).toEqual({
      storedScore: 80,
      mastered: true,
    });
    expect(decideOutcome({ kind: "patch", rawScore: 80, passedAll: true, performance: 1, hintsUsed: 2, late: false })).toEqual({
      storedScore: 68,
      mastered: false,
    });
    expect(decideOutcome({ kind: "incident", rawScore: 100, passedAll: true, performance: 1, hintsUsed: 0, late: true })).toEqual({
      storedScore: 60,
      mastered: false,
    });
    expect(decideOutcome({ kind: "patch", rawScore: 90, passedAll: false, performance: 1, hintsUsed: 0, late: false }).mastered).toBe(false);
    expect(decideOutcome({ kind: "patch", rawScore: 100, passedAll: true, performance: 0, hintsUsed: 0, late: false }).mastered).toBe(false);
  });

  it("does not penalize hints on a non-patch kind", () => {
    expect(decideOutcome({ kind: "choice", rawScore: 100, passedAll: true, performance: 1, hintsUsed: 3, late: false })).toEqual({
      storedScore: 100,
      mastered: true,
    });
  });

  it("keeps the incident open and locks a node with an unmet prerequisite", () => {
    expect(isLocked("incident", ["sec-llm"], new Set())).toBe(false);
    expect(isLocked("patch", ["dbg-state-basics"], new Set())).toBe(true);
    expect(isLocked("patch", ["dbg-state-basics"], new Set(["dbg-state-basics"]))).toBe(false);
  });
});

describe("heatmap", () => {
  it("builds sixteen Sunday-aligned weeks and a median", () => {
    const cells = buildHeatmap(["2026-10-05", "2026-10-05"], new Date(2026, 9, 5, 15));
    expect(cells).toHaveLength(112);
    expect(cells.filter((cell) => cell.date === "")).toHaveLength(5);
    expect(cells.find((cell) => cell.date === "2026-10-05")?.count).toBe(2);
    const [year, month, day] = cells[0].date.split("-").map(Number);
    expect(new Date(Date.UTC(year, month - 1, day)).getUTCDay()).toBe(0);
    expect(median([10, 30, 20])).toBe(20);
    expect(median([10, 40])).toBe(25);
    expect(median([])).toBeNull();
  });
});

describe("confirmation mail", () => {
  it("puts a one-time link in the message and names the dev mailbox", () => {
    const message = verificationMessage("http://localhost:3000", "abc_DEF-123");
    expect(message.subject).toContain("Confirm");
    expect(message.text).toContain("http://localhost:3000/verify?token=abc_DEF-123");
    expect(message.text).toContain("strayapps.co@gmail.com");
    expect(message.text).not.toContain("password");
  });
});

describe("firestore store", () => {
  it("refuses every call until the migration is turned on", async () => {
    const store = new FirestoreStore();
    await expect(store.masteredIds("user")).rejects.toThrow(/firebase-migration/);
  });
});
