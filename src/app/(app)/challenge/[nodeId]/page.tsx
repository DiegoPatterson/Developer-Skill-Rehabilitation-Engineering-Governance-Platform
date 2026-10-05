import { Workspace } from "@/components/workspace";
import { getViewer } from "@/server/auth";
import { loadWorkspace } from "@/server/workspace";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  return { title: `${nodeId} · Skill Governance` };
}

export default async function ChallengePage({ params }: { params: Promise<{ nodeId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { nodeId } = await params;
  const loaded = await loadWorkspace(viewer.id, nodeId);
  if (!loaded) notFound();
  return <Workspace key={loaded.view.id} view={loaded.view} attempt={loaded.attempt} />;
}
