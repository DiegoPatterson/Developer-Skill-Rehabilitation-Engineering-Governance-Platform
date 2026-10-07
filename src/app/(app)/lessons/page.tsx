import { LessonList } from "@/components/lesson-list";
import { canReview } from "@/content/roles";
import { getViewer } from "@/server/auth";
import { listAcceptedPaths } from "@/server/path-proposals";
import { loadGraph } from "@/server/workspace";
import { redirect } from "next/navigation";

export const metadata = { title: "Lessons · Skill Governance" };

export default async function LessonsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const staff = canReview(viewer.role);
  const [{ nodes }, community] = await Promise.all([loadGraph(viewer.id), listAcceptedPaths()]);
  return <LessonList nodes={nodes} staff={staff} communityPaths={community} />;
}
