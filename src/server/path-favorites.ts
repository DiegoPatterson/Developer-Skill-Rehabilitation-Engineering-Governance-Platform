import "server-only";
import { z } from "zod";
import { isLearningPathId } from "@/content/paths";
import { getDb } from "./db";
import { getPublishedPath } from "./path-proposals";
import { ProposalError } from "./proposals";

const bodySchema = z.object({
  pathId: z.string().trim().min(1).max(40),
  favorite: z.boolean(),
});

export async function listFavoritePathIds(userId: string): Promise<string[]> {
  const rows = await getDb().learningPathFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { pathId: true },
  });
  return rows.map((row) => row.pathId);
}

export async function setPathFavorite(userId: string, input: unknown): Promise<void> {
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success || !isLearningPathId(parsed.data.pathId)) {
    throw new ProposalError(400, "That favorite is incomplete.");
  }
  const { pathId, favorite } = parsed.data;
  const db = getDb();
  if (!favorite) {
    await db.learningPathFavorite.deleteMany({ where: { userId, pathId } });
    return;
  }
  const path = await getPublishedPath(pathId);
  if (!path) throw new ProposalError(404, "That path was not found.");
  await db.learningPathFavorite.upsert({
    where: { userId_pathId: { userId, pathId } },
    create: { userId, pathId },
    update: {},
  });
}
