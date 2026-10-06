import "server-only";
import { canReview } from "@/content/roles";
import { challengeJson } from "@/content/catalog-record";
import {
  nextLessonNumber,
  parseProposal,
  resolvePrereqNumbers,
  toChallenge,
  type ProposalDraft,
} from "@/content/proposal";
import type { UserRole } from "@/content/roles";
import type { Prisma } from "@/generated/prisma/client";
import { activeLessonMap, getDb, refreshLiveCatalog } from "./db";

const PENDING_CAP = 20;

export type ProposalListItem = {
  id: string;
  label: string;
  title: string;
  category: string;
  kind: string;
  difficulty: number;
  status: "pending" | "approved" | "rejected";
  lessonNumber: number | null;
  nodeId: string | null;
  reviewNote: string | null;
  author: string;
  createdAt: string;
  reviewedAt: string | null;
};

export class ProposalError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function listItem(row: {
  id: string;
  label: string;
  title: string;
  category: string;
  kind: string;
  difficulty: number;
  status: "pending" | "approved" | "rejected";
  lessonNumber: number | null;
  nodeId: string | null;
  reviewNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  author: { username: string };
}): ProposalListItem {
  return {
    id: row.id,
    label: row.label,
    title: row.title,
    category: row.category,
    kind: row.kind,
    difficulty: row.difficulty,
    status: row.status,
    lessonNumber: row.lessonNumber,
    nodeId: row.nodeId,
    reviewNote: row.reviewNote,
    author: row.author.username,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

const listSelect = {
  id: true,
  label: true,
  title: true,
  category: true,
  kind: true,
  difficulty: true,
  status: true,
  lessonNumber: true,
  nodeId: true,
  reviewNote: true,
  createdAt: true,
  reviewedAt: true,
  author: { select: { username: true } },
} as const;



function columnData(draft: ProposalDraft, payload: ProposalDraft) {
  return {
    label: draft.label,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    kind: draft.kind,
    difficulty: draft.difficulty,
    showInGraph: draft.showInGraph,
    prereqNumbers: draft.prereqNumbers,
    payload: JSON.parse(JSON.stringify(payload)),
  };
}

export async function listMyProposals(userId: string): Promise<ProposalListItem[]> {
  const rows = await getDb().problemProposal.findMany({
    where: { authorId: userId },
    select: listSelect,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(listItem);
}

export async function getMyProposal(userId: string, id: string): Promise<{ item: ProposalListItem; draft: ProposalDraft } | null> {
  const row = await getDb().problemProposal.findFirst({
    where: { id, authorId: userId },
    select: { ...listSelect, payload: true },
  });
  if (!row) return null;
  const parsed = parseProposal(row.payload);
  if (!parsed.ok) return null;
  return { item: listItem(row), draft: parsed.draft };
}

export async function listReviewQueue(): Promise<ProposalListItem[]> {
  const rows = await getDb().problemProposal.findMany({ select: listSelect, orderBy: { createdAt: "asc" } });
  const rank = { pending: 0, rejected: 1, approved: 2 };
  return rows.map(listItem).sort((a, b) => rank[a.status] - rank[b.status] || a.createdAt.localeCompare(b.createdAt));
}

export async function getReviewProposal(id: string): Promise<{ item: ProposalListItem; draft: ProposalDraft } | null> {
  const row = await getDb().problemProposal.findUnique({
    where: { id },
    select: { ...listSelect, payload: true },
  });
  if (!row) return null;
  const parsed = parseProposal(row.payload);
  if (!parsed.ok) return null;
  return { item: listItem(row), draft: parsed.draft };
}

export async function createProposal(userId: string, input: unknown): Promise<ProposalListItem> {
  const parsed = parseProposal(input);
  if (!parsed.ok) throw new ProposalError(400, parsed.error);
  const db = getDb();
  const pending = await db.problemProposal.count({ where: { authorId: userId, status: "pending" } });
  if (pending >= PENDING_CAP) throw new ProposalError(400, "You already have 20 problems waiting for review.");
  const resolved = resolvePrereqNumbers(parsed.draft.prereqNumbers, await activeLessonMap());
  if ("error" in resolved) throw new ProposalError(400, resolved.error);
  const row = await db.problemProposal.create({
    data: { authorId: userId, ...columnData(parsed.draft, parsed.draft) },
    select: listSelect,
  });
  return listItem(row);
}

export async function updateProposal(userId: string, id: string, input: unknown): Promise<ProposalListItem> {
  const parsed = parseProposal(input);
  if (!parsed.ok) throw new ProposalError(400, parsed.error);
  const db = getDb();
  const existing = await db.problemProposal.findFirst({ where: { id, authorId: userId }, select: { status: true } });
  if (!existing) throw new ProposalError(404, "That problem was not found.");
  if (existing.status === "approved") throw new ProposalError(400, "An accepted problem stays as it was accepted.");
  if (existing.status !== "pending") {
    const pending = await db.problemProposal.count({ where: { authorId: userId, status: "pending" } });
    if (pending >= PENDING_CAP) throw new ProposalError(400, "You already have 20 problems waiting for review.");
  }
  const resolved = resolvePrereqNumbers(parsed.draft.prereqNumbers, await activeLessonMap());
  if ("error" in resolved) throw new ProposalError(400, resolved.error);
  const row = await db.problemProposal.update({
    where: { id },
    data: {
      ...columnData(parsed.draft, parsed.draft),
      status: "pending",
      reviewNote: null,
      reviewerId: null,
      reviewedAt: null,
    },
    select: listSelect,
  });
  return listItem(row);
}

export async function decideProposal(
  reviewerId: string,
  role: UserRole,
  id: string,
  action: "approve" | "reject",
  note: string,
): Promise<ProposalListItem> {
  if (!canReview(role)) throw new ProposalError(403, "Only an admin can review problems.");
  const trimmed = note.trim();
  if (action === "reject" && trimmed.length < 3) throw new ProposalError(400, "Write a note explaining the rejection.");
  if (trimmed.length > 1000) throw new ProposalError(400, "The note must be 1000 characters or fewer.");
  const db = getDb();
  if (action === "reject") {
    const existing = await db.problemProposal.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new ProposalError(404, "That problem was not found.");
    if (existing.status !== "pending") throw new ProposalError(400, "This problem was already reviewed.");
    const row = await db.problemProposal.update({
      where: { id },
      data: { status: "rejected", reviewNote: trimmed, reviewerId, reviewedAt: new Date() },
      select: listSelect,
    });
    return listItem(row);
  }

  try {
    await db.$transaction(async (tx) => {
      const row = await tx.problemProposal.findUnique({ where: { id } });
      if (!row) throw new ProposalError(404, "That problem was not found.");
      if (row.status !== "pending") throw new ProposalError(400, "This problem was already reviewed.");
      const parsed = parseProposal(row.payload);
      if (!parsed.ok) throw new ProposalError(400, parsed.error);
      const published = await activeLessonMap(tx);
      const resolved = resolvePrereqNumbers(parsed.draft.prereqNumbers, published);
      if ("error" in resolved) throw new ProposalError(400, resolved.error);
      const number = nextLessonNumber(published.keys());
      const nodeId = `community-${number}`;
      const challenge = toChallenge(parsed.draft, number, nodeId, resolved.ids);
      await tx.problemProposal.update({
        where: { id },
        data: {
          status: "approved",
          lessonNumber: number,
          nodeId,
          reviewNote: trimmed || null,
          reviewerId,
          reviewedAt: new Date(),
        },
      });
      await tx.skillNode.create({
        data: {
          id: nodeId,
          title: challenge.title,
          category: challenge.category,
          prerequisiteNodeIds: challenge.prereqs,
          difficultyLevel: challenge.difficulty,
          summary: challenge.summary,
          showInGraph: challenge.showInGraph,
          lessonNumber: number,
          kind: challenge.kind,
          label: challenge.label ?? "",
          active: true,
          payload: challengeJson(challenge) as Prisma.InputJsonValue,
        },
      });
    });
  } catch (error) {
    if (error instanceof ProposalError) throw error;
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") {
      throw new ProposalError(409, "That lesson number was just taken. Try again.");
    }
    throw error;
  }
  await refreshLiveCatalog();
  const row = await db.problemProposal.findUniqueOrThrow({ where: { id }, select: listSelect });
  return listItem(row);
}
