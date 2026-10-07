import { PathStepper } from "@/components/path-stepper";
import { getViewer } from "@/server/auth";
import { listFavoritePathIds } from "@/server/path-favorites";
import { getPublishedPath } from "@/server/path-proposals";
import { loadGraph } from "@/server/workspace";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

type LearnPathPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: LearnPathPageProps): Promise<Metadata> {
  const { id } = await params;
  const path = await getPublishedPath(id);
  return { title: path ? `${path.topic} · Learning · Skill Governance` : "Learning · Skill Governance" };
}

export default async function LearnPathPage({ params }: LearnPathPageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { id } = await params;
  const path = await getPublishedPath(id);
  if (!path) notFound();
  const [{ nodes }, favoriteIds] = await Promise.all([loadGraph(viewer.id), listFavoritePathIds(viewer.id)]);
  return <PathStepper path={path} nodes={nodes} favorite={favoriteIds.includes(path.id)} />;
}