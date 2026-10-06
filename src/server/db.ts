import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { assertCatalog, challenges } from "@/content/catalog";
import { challengeFromRow, challengeJson, type CatalogRow } from "@/content/catalog-record";
import { challengesFromApproved } from "@/content/proposal";
import { replaceLiveChallenges } from "@/content/published";
import type { Challenge } from "@/content/types";

const globalForPrisma = globalThis as unknown as {
  skillGovernancePrismaV2?: PrismaClient;
  skillGovernanceSeedV2?: Promise<void>;
};

export function getDb(): PrismaClient {
  if (!globalForPrisma.skillGovernancePrismaV2) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set.");
    globalForPrisma.skillGovernancePrismaV2 = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }
  return globalForPrisma.skillGovernancePrismaV2;
}

export function ensureCatalog(): Promise<void> {
  globalForPrisma.skillGovernanceSeedV2 ??= seedCatalog().catch((error: unknown) => {
    globalForPrisma.skillGovernanceSeedV2 = undefined;
    throw error;
  });
  return globalForPrisma.skillGovernanceSeedV2.then(() => refreshLiveCatalog());
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
