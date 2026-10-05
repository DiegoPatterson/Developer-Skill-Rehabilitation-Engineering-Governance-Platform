import { SkillGraph } from "@/components/skill-graph";
import { getViewer } from "@/server/auth";
import { loadGraph } from "@/server/workspace";
import { redirect } from "next/navigation";

export const metadata = { title: "Graph · Skill Governance" };

export default async function GraphPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { nodes } = await loadGraph(viewer.id);
  return <SkillGraph nodes={nodes} />;
}
