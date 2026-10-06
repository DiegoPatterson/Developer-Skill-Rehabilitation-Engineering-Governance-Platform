import { LessonList } from "@/components/lesson-list";
import { canReview } from "@/content/roles";
import { getViewer } from "@/server/auth";
import { loadGraph, loadRetiredLessons } from "@/server/workspace";
import { redirect } from "next/navigation";

export const metadata = { title: "Lessons · Skill Governance" };

export default async function LessonsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const staff = canReview(viewer.role);
  const { nodes } = await loadGraph(viewer.id);
  const retired = staff ? await loadRetiredLessons() : [];
  return <LessonList nodes={nodes} staff={staff} retired={retired} />;
}
