/* eslint-disable @typescript-eslint/no-unused-vars -- parameters match ProgressStore; every method rejects */
import type { AttemptView } from "@/content/view-model";
import type { DashboardData, ProgressStore, SubmissionInput, SubmissionResult } from "./types";

const MESSAGE = "Firestore is not enabled. See docs/firebase-migration.md.";

function unavailable(): never {
  throw new Error(MESSAGE);
}

export class FirestoreStore implements ProgressStore {
  async masteredIds(_userId: string): Promise<Set<string>> {
    unavailable();
  }

  async openAttempt(_userId: string, _nodeId: string): Promise<AttemptView> {
    unavailable();
  }

  async resetAttempt(_userId: string, _nodeId: string): Promise<AttemptView> {
    unavailable();
  }

  async revealHint(_userId: string, _nodeId: string): Promise<{ hints: string[]; hintsUsed: number; hintCount: number }> {
    unavailable();
  }

  async recordSubmission(_input: SubmissionInput): Promise<SubmissionResult> {
    unavailable();
  }

  async dashboard(_userId: string): Promise<DashboardData> {
    unavailable();
  }
}
