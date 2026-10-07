import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { assertCatalog, challenges } from "@/content/catalog";
import { challengeFromRow, challengeJson, type CatalogRow } from "@/content/catalog-record";
import { challengesFromApproved } from "@/content/proposal";
import { replaceLiveChallenges } from "@/content/published";
import type { Challenge } from "@/content/types";

const globalForPrisma = globalThis as unknown as {
  skillGovernancePrismaV5?: PrismaClient;
  skillGovernanceSeedV5?: Promise<void>;
};

function clientIsCurrent(client: PrismaClient): boolean {
  return (
    typeof client.learningPathProposal?.findMany === "function" &&
    typeof client.learningPathFavorite?.findMany === "function"
  );
}

export function getDb(): PrismaClient {
  const cached = globalForPrisma.skillGovernancePrismaV5;
  if (cached && clientIsCurrent(cached)) return cached;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  if (!clientIsCurrent(client)) {
    throw new Error("The database client is stale. Restart npm run dev.");
  }
  globalForPrisma.skillGovernancePrismaV5 = client;
  return client;
}

export function ensureCatalog(): Promise<void> {
  globalForPrisma.skillGovernanceSeedV5 ??= seedCatalog().catch((error: unknown) => {
    globalForPrisma.skillGovernanceSeedV5 = undefined;
    throw error;
  });
  return globalForPrisma.skillGovernanceSeedV5.then(() => refreshLiveCatalog());
}

function storedPayload(challenge: Challenge): Prisma.InputJsonValue {
  return challengeJson(challenge) as Prisma.InputJsonValue;
}

function createData(challenge: Challenge) {
  return {
    id: challenge.id,
    title: challenge.title,
    category: challenge.category,
    prerequisiteNodeIds: challenge.prereqs,
    difficultyLevel: challenge.difficulty,
    summary: challenge.summary,
    showInGraph: challenge.showInGraph,
    lessonNumber: challenge.number,
    kind: challenge.kind,
    label: challenge.label ?? "",
    active: true,
    payload: storedPayload(challenge),
  };
}

async function seedCatalog(): Promise<void> {
  assertCatalog();
  const db = getDb();
  for (const challenge of challenges) {
    const existing = await db.skillNode.findUnique({ where: { id: challenge.id }, select: { payload: true } });
    if (!existing) {
      await db.skillNode.create({ data: createData(challenge) });
      continue;
    }
    if (existing.payload == null) {
      await db.skillNode.update({
        where: { id: challenge.id },
        data: {
          payload: storedPayload(challenge),
          lessonNumber: challenge.number,
          kind: challenge.kind,
          label: challenge.label ?? "",
        },
      });
    }
  }
  const approved = await db.problemProposal.findMany({
    where: { status: "approved" },
    select: { payload: true, lessonNumber: true, nodeId: true },
  });
  for (const challenge of challengesFromApproved(approved)) {
    const existing = await db.skillNode.findUnique({ where: { id: challenge.id }, select: { payload: true } });
    if (!existing) {
      await db.skillNode.create({ data: createData(challenge) });
      continue;
    }
    if (existing.payload == null) {
      await db.skillNode.update({
        where: { id: challenge.id },
        data: {
          payload: storedPayload(challenge),
          lessonNumber: challenge.number,
          kind: challenge.kind,
          label: challenge.label ?? "",
          title: challenge.title,
          category: challenge.category,
          prerequisiteNodeIds: challenge.prereqs,
          difficultyLevel: challenge.difficulty,
          summary: challenge.summary,
        },
      });
    }
  }
}

export async function refreshLiveCatalog(): Promise<void> {
  const rows = await getDb().skillNode.findMany({ where: { active: true }, orderBy: { lessonNumber: "asc" } });
  const list: Challenge[] = [];
  for (const row of rows) {
    const challenge = challengeFromRow(row as CatalogRow);
    if (challenge) list.push(challenge);
    else console.error("skipping skill node", row.id);
  }
  replaceLiveChallenges(list);
}

export async function activeLessonMap(db: PrismaClient | Prisma.TransactionClient = getDb()): Promise<Map<number, string>> {
  const rows = await db.skillNode.findMany({
    where: { active: true, lessonNumber: { not: null } },
    select: { id: true, lessonNumber: true },
  });
  const map = new Map<number, string>();
  for (const row of rows) {
    if (row.lessonNumber != null) map.set(row.lessonNumber, row.id);
  }
  return map;
}
