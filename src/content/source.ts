import "server-only";
import { findChallenge, listChallenges } from "./published";
import type { Challenge } from "./types";

export interface ChallengeSource {
  list(): Challenge[];
  get(id: string): Challenge | undefined;
}

class CatalogSource implements ChallengeSource {
  list(): Challenge[] {
    return listChallenges();
  }

  get(id: string): Challenge | undefined {
    return findChallenge(id);
  }
}

/**
 * The live catalog is curated and executed.
 * A later generator can call SpaceXAI at https://api.x.ai/v1 with XAI_API_KEY, server-side only.
 * This build does not call it and does not invent a model response.
 */
export function createSource(): ChallengeSource {
  return new CatalogSource();
}
