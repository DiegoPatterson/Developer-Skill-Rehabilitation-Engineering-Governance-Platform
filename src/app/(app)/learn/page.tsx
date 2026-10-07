import { LessonPaths } from "@/components/lesson-paths";
import { getViewer } from "@/server/auth";
import { listFavoritePathIds } from "@/server/path-favorites";
import { listAcceptedPaths } from "@/server/path-proposals";
import { loadGraph } from "@/server/workspace";
import { redirect } from "next/navigation";

export const metadata = { title: "Learning · Skill Governance" };

export default async function LearnPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const [{ nodes }, community, favoriteIds] = await Promise.all([
    loadGraph(viewer.id),
    listAcceptedPaths(),
    listFavoritePathIds(viewer.id),
  ]);
  return <LessonPaths nodes={nodes} community={community} favoriteIds={favoriteIds} />;
}
