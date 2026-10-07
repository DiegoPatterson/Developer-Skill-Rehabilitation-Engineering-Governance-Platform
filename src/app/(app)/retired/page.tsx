import { RetiredLessons } from "@/components/retired-lessons";
import { canReview } from "@/content/roles";
import { getViewer } from "@/server/auth";
import { loadRetiredLessons } from "@/server/workspace";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Retired · Skill Governance" };

export default async function RetiredPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canReview(viewer.role)) redirect("/lessons");
  const lessons = await loadRetiredLessons();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <Link href="/admin" className="text-sm text-zinc-400">
        Admin panel
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Retired lessons</h1>
        <p className="mt-2 text-sm text-zinc-400">Restoring a lesson puts it back in Lessons. It does not rewrite a learning path.</p>
      </div>
      <RetiredLessons lessons={lessons} />
    </main>
  );
}
