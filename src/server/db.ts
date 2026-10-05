import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { assertCatalog, challenges } from "@/content/catalog";

const globalForPrisma = globalThis as unknown as {
  skillGovernanceDb?: PrismaClient;
  skillGovernanceCatalog?: Promise<void>;
};

export function getDb(): PrismaClient {
  if (!globalForPrisma.skillGovernanceDb) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set.");
    globalForPrisma.skillGovernanceDb = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }
  return globalForPrisma.skillGovernanceDb;
}

export function ensureCatalog(): Promise<void> {
  globalForPrisma.skillGovernanceCatalog ??= seedCatalog();
  return globalForPrisma.skillGovernanceCatalog;
}

async function seedCatalog(): Promise<void> {
  try {
    assertCatalog();
    const db = getDb();
    for (const challenge of challenges) {
      const data = {
        title: challenge.title,
        category: challenge.category,
        prerequisiteNodeIds: challenge.prereqs,
        difficultyLevel: challenge.difficulty,
        summary: challenge.summary,
        showInGraph: challenge.showInGraph,
      };
      await db.skillNode.upsert({
        where: { id: challenge.id },
        create: { id: challenge.id, ...data },
        update: data,
      });
    }
  } catch (error) {
    globalForPrisma.skillGovernanceCatalog = undefined;
    throw error;
  }
}
