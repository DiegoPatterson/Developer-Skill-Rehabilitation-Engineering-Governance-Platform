import { LessonPaths } from "@/components/lesson-paths";
import { getViewer } from "@/server/auth";
import { loadGraph } from "@/server/workspace";
import { redirect } from "next/navigation";

export const metadata = { title: "Learning · Skill Governance" };

export default async function LearnPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { nodes } = await loadGraph(viewer.id);
  return <LessonPaths nodes={nodes} />;
}
