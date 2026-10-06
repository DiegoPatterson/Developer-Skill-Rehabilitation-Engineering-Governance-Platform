import { SkillGraph } from "@/components/skill-graph";
import { canReview } from "@/content/roles";
import { getViewer } from "@/server/auth";
import { loadGraph, loadRetiredLessons } from "@/server/workspace";
import { redirect } from "next/navigation";

export const metadata = { title: "Graph · Skill Governance" };

export default async function GraphPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const staff = canReview(viewer.role);
  const { nodes } = await loadGraph(viewer.id);
  const retired = staff ? await loadRetiredLessons() : [];
  return <SkillGraph nodes={nodes} staff={staff} retired={retired} />;
}
