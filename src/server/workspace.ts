import "server-only";
import { createSource } from "@/content/source";
import { graphNodeViews, skillLinks, toWorkspace } from "@/content/view";
import type { GraphNodeView, SkillLink, WorkspaceView } from "@/content/view-model";
import type { AttemptView } from "@/content/view-model";
import { createStore } from "./store";

export async function loadGraph(userId: string): Promise<{ nodes: GraphNodeView[]; skills: SkillLink[] }> {
  const source = createSource();
  const list = source.list();
  const mastered = await createStore().masteredIds(userId);
  return { nodes: graphNodeViews(list, mastered), skills: skillLinks(list) };
}

export async function loadWorkspace(userId: string, nodeId: string): Promise<{ view: WorkspaceView; attempt: AttemptView | null } | null> {
  const source = createSource();
  const challenge = source.get(nodeId);
  if (!challenge) return null;
  const list = source.list();
  const store = createStore();
  const mastered = await store.masteredIds(userId);
  const titles = new Map(list.map((item) => [item.id, item.title]));
  const view = toWorkspace(challenge, mastered, titles);
  const attempt = view.locked ? null : await store.openAttempt(userId, nodeId);
  return { view, attempt };
}
