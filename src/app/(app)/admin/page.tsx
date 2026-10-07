import { canReview } from "@/content/roles";
import { getViewer } from "@/server/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Admin panel · Skill Governance" };

const TOOLS = [
  {
    href: "/review",
    title: "Review",
    detail: "Accept or reject proposed problems and learning paths.",
  },
  {
    href: "/retired",
    title: "Retired",
    detail: "Restore a lesson that was taken out of the catalog.",
  },
  {
    href: "/propose/path",
    title: "Propose a path",
    detail: "Order lessons into a learning path.",
  },
];

export default async function AdminPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canReview(viewer.role)) redirect("/lessons");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Admin panel</h1>
        <p className="mt-2 text-sm text-zinc-400">Tools for admins and owners.</p>
      </div>
      <div className="flex flex-col gap-3">
        {TOOLS.map((tool) => (
          <Link key={tool.href} href={tool.href} className="rounded-lg border border-[#27272A] bg-[#121215] px-3 py-3 hover:border-[#3f3f46]">
            <div className="text-sm font-medium text-zinc-100">{tool.title}</div>
            <p className="mt-1 text-sm text-zinc-400">{tool.detail}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
