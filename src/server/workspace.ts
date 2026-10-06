import "server-only";
import { createSource } from "@/content/source";
import { graphNodeViews, skillLinks, toWorkspace } from "@/content/view";
import type { GraphNodeView, RetiredLesson, SkillLink, WorkspaceView } from "@/content/view-model";
import type { AttemptView } from "@/content/view-model";
import { getDb } from "./db";
import { createStore } from "./store";

export async function loadGraph(userId: string): Promise<{ nodes: GraphNodeView[]; skills: SkillLink[] }> {
  const source = createSource();
  const list = source.list();
  const mastered = await createStore().masteredIds(userId);
  return { nodes: graphNodeViews(list, mastered), skills: skillLinks(list) };
}

export async function loadRetiredLessons(): Promise<RetiredLesson[]> {
  const rows = await getDb().skillNode.findMany({
    where: { active: false },
    select: { id: true, lessonNumber: true, title: true, category: true },
    orderBy: { lessonNumber: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    number: row.lessonNumber ?? 0,
    title: row.title,
    category: row.category,
  }));
}

export async function loadWorkspace(userId: string, nodeId: string): Promise<{ view: WorkspaceView; attempt: AttemptView | null } | null> {
  const source = createSource();
  const challenge = source.get(nodeId);
  if (!challenge) return null;
  const list = source.list();
  const store = createStore();
  const mastered = await store.masteredIds(userId);
  const titles = new Map(list.map((item) => [item.id, { title: item.title, number: item.number }]));
  const view = toWorkspace(challenge, mastered, titles);
  const attempt = view.locked ? null : await store.openAttempt(userId, nodeId);
  return { view, attempt };
}
