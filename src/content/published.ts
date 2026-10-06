import { challenges as curated } from "./catalog";
import type { Challenge } from "./types";

let live: Challenge[] | null = null;

export function replaceLiveChallenges(next: Challenge[] | null): void {
  live = next;
}

export function listChallenges(): Challenge[] {
  return live ?? curated;
}

export function findChallenge(id: string): Challenge | undefined {
  return (live ?? curated).find((challenge) => challenge.id === id);
}
