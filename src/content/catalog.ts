import { patchChallenges } from "./patch";
import { patchRest } from "./patch-rest";
import { studioChallenges } from "./studio";
import type { Challenge } from "./types";

export const challenges: Challenge[] = [...patchChallenges, ...patchRest, ...studioChallenges];

const byId = new Map(challenges.map((challenge) => [challenge.id, challenge]));

export function getChallenge(id: string): Challenge | undefined {
  return byId.get(id);
}

export function graphChallenges(): Challenge[] {
  return challenges.filter((challenge) => challenge.showInGraph);
}

export function assertCatalog(): void {
  const ids = new Set<string>();
  const numbers = new Set<number>();
  for (const challenge of challenges) {
    if (ids.has(challenge.id)) throw new Error(`Duplicate challenge ${challenge.id}`);
    ids.add(challenge.id);
    if (!Number.isInteger(challenge.number) || challenge.number < 1) {
      throw new Error(`${challenge.id} needs a positive lesson number`);
    }
    if (numbers.has(challenge.number)) throw new Error(`Duplicate lesson number ${challenge.number}`);
    numbers.add(challenge.number);
  }
  for (const challenge of challenges) {
    for (const prereq of challenge.prereqs) {
      if (!ids.has(prereq)) throw new Error(`${challenge.id} requires missing ${prereq}`);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function walk(id: string) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Cycle at ${id}`);
    visiting.add(id);
    for (const prereq of byId.get(id)?.prereqs ?? []) walk(prereq);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) walk(id);
}
