import "server-only";
import { FirestoreStore } from "./firestore-store";
import { PrismaProgressStore } from "./prisma-store";
import type { ProgressStore } from "./types";

export function createStore(): ProgressStore {
  if (process.env.DATA_DRIVER === "firestore") return new FirestoreStore();
  return new PrismaProgressStore();
}
