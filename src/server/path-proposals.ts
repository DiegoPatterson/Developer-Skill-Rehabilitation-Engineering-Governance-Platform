import "server-only";
import { parsePathProposal, type PathDraft, type PathLessonChoice, type PublishedPath } from "@/content/path-proposal";
import { LESSON_PATHS } from "@/content/paths";
import { canReview, type UserRole } from "@/content/roles";
import { createSource } from "@/content/source";
import { activeLessonMap, getDb } from "./db";
import { ProposalError } from "./proposals";

const PENDING_CAP = 20;

export type PathProposalItem = {
  id: string;
  topic: string;
  description: string;
  lessonNumbers: number[];
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  author: string;
  createdAt: string;
  reviewedAt: string | null;
};

const listSelect = {
  id: true,
  topic: true,
  description: true,
  lessonNumbers: true,
  status: true,
  reviewNote: true,
  createdAt: true,
  reviewedAt: true,
  author: { select: { username: true } },
} as const;

function listItem(row: {
  id: string;
  topic: string;
  description: string;
  lessonNumbers: number[];
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  author: { username: string };
}): PathProposalItem {
  return {
    id: row.id,
    topic: row.topic,
    description: row.description,
    lessonNumbers: row.lessonNumbers,
    status: row.status,
    reviewNote: row.reviewNote,
    author: row.author.username,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

async function activeNumbers(): Promise<Set<number>> {
  return new Set((await activeLessonMap()).keys());
}

export function pathLessonChoices(): PathLessonChoice[] {
  return createSource()
    .list()
    .map((lesson) => ({
      number: lesson.number,
      title: lesson.title,
      category: lesson.category,
      difficulty: lesson.difficulty,
    }))
    .sort((left, right) => left.number - right.number);
}

export async function getPublishedPath(id: string): Promise<PublishedPath | null> {
  const builtIn = LESSON_PATHS.find((path) => path.id === id);
  if (builtIn) return { id: builtIn.id, topic: builtIn.title, description: builtIn.blurb, steps: builtIn.steps };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const row = await getDb().learningPathProposal.findFirst({
    where: { id, status: "approved" },
    select: { id: true, topic: true, description: true, lessonNumbers: true },
  });
  if (!row) return null;
  return { id: row.id, topic: row.topic, description: row.description, steps: row.lessonNumbers };
}

export async function listAcceptedPaths(): Promise<PublishedPath[]> {
  const rows = await getDb().learningPathProposal.findMany({
    where: { status: "approved" },
    orderBy: { reviewedAt: "asc" },
    select: { id: true, topic: true, description: true, lessonNumbers: true },
  });
  return rows.map((row) => ({
    id: row.id,
    topic: row.topic,
    description: row.description,
    steps: row.lessonNumbers,
  }));
}

export async function listMyPathProposals(userId: string): Promise<PathProposalItem[]> {
  const rows = await getDb().learningPathProposal.findMany({
    where: { authorId: userId },
    select: listSelect,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(listItem);
}

export async function getMyPathProposal(userId: string, id: string): Promise<{ item: PathProposalItem; draft: PathDraft } | null> {
  const row = await getDb().learningPathProposal.findFirst({
    where: { id, authorId: userId },
    select: listSelect,
  });
  if (!row) return null;
  return {
    item: listItem(row),
    draft: { topic: row.topic, description: row.description, lessonNumbers: row.lessonNumbers },
  };
}

export async function listPathReviewQueue(): Promise<PathProposalItem[]> {
  const rows = await getDb().learningPathProposal.findMany({ select: listSelect, orderBy: { createdAt: "asc" } });
  const rank = { pending: 0, rejected: 1, approved: 2 };
  return rows.map(listItem).sort((left, right) => rank[left.status] - rank[right.status] || left.createdAt.localeCompare(right.createdAt));
}

export async function getReviewPath(id: string): Promise<PathProposalItem | null> {
  const row = await getDb().learningPathProposal.findUnique({ where: { id }, select: listSelect });
  return row ? listItem(row) : null;
}

export async function createPathProposal(userId: string, role: UserRole, input: unknown): Promise<PathProposalItem> {
  if (!canReview(role)) throw new ProposalError(403, "Only an admin can propose a learning path.");
  const parsed = parsePathProposal(input, await activeNumbers());
  if (!parsed.ok) throw new ProposalError(400, parsed.error);
  const db = getDb();
  const pending = await db.learningPathProposal.count({ where: { authorId: userId, status: "pending" } });
  if (pending >= PENDING_CAP) throw new ProposalError(400, "You already have 20 learning paths waiting for review.");
  const row = await db.learningPathProposal.create({
    data: { authorId: userId, ...parsed.draft },
    select: listSelect,
  });
  return listItem(row);
}

export async function updatePathProposal(userId: string, role: UserRole, id: string, input: unknown): Promise<PathProposalItem> {
  if (!canReview(role)) throw new ProposalError(403, "Only an admin can propose a learning path.");
  const parsed = parsePathProposal(input, await activeNumbers());
  if (!parsed.ok) throw new ProposalError(400, parsed.error);
  const db = getDb();
  const existing = await db.learningPathProposal.findFirst({ where: { id, authorId: userId }, select: { status: true } });
  if (!existing) throw new ProposalError(404, "That learning path was not found.");
  if (existing.status === "approved") throw new ProposalError(400, "An accepted learning path stays as it was accepted.");
  if (existing.status !== "pending") {
    const pending = await db.learningPathProposal.count({ where: { authorId: userId, status: "pending" } });
    if (pending >= PENDING_CAP) throw new ProposalError(400, "You already have 20 learning paths waiting for review.");
  }
  const row = await db.learningPathProposal.update({
    where: { id },
    data: {
      ...parsed.draft,
      status: "pending",
      reviewNote: null,
      reviewerId: null,
      reviewedAt: null,
    },
    select: listSelect,
  });
  return listItem(row);
}

export async function decidePathProposal(
  reviewerId: string,
  role: UserRole,
  id: string,
  action: "approve" | "reject",
  note: string,
): Promise<PathProposalItem> {
  if (!canReview(role)) throw new ProposalError(403, "Only an admin can review learning paths.");
  const trimmed = note.trim();
  if (action === "reject" && trimmed.length < 3) throw new ProposalError(400, "Write a note explaining the rejection.");
  if (trimmed.length > 1000) throw new ProposalError(400, "The note must be 1000 characters or fewer.");
  const db = getDb();
  const existing = await db.learningPathProposal.findUnique({ where: { id }, select: listSelect });
  if (!existing) throw new ProposalError(404, "That learning path was not found.");
  if (existing.status !== "pending") throw new ProposalError(400, "This learning path was already reviewed.");
  if (action === "approve") {
    const parsed = parsePathProposal(
      { topic: existing.topic, description: existing.description, lessonNumbers: existing.lessonNumbers },
      await activeNumbers(),
    );
    if (!parsed.ok) throw new ProposalError(400, parsed.error);
  }
  const row = await db.learningPathProposal.update({
    where: { id },
    data: {
      status: action === "approve" ? "approved" : "rejected",
      reviewNote: trimmed || null,
      reviewerId,
      reviewedAt: new Date(),
    },
    select: listSelect,
  });
  return listItem(row);
}
