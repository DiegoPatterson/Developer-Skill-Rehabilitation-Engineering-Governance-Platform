import { lessonTypeLabel } from "@/content/lesson";
import { proposalKindLabel } from "@/content/proposal";
import { formatProblemCount } from "@/content/paths";
import { canReview } from "@/content/roles";
import { getViewer } from "@/server/auth";
import { listPathReviewQueue } from "@/server/path-proposals";
import { listReviewQueue } from "@/server/proposals";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Review · Skill Governance" };

const STATUS = { pending: "Pending", approved: "Accepted", rejected: "Rejected" };

export default async function ReviewPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canReview(viewer.role)) redirect("/lessons");
  const [queue, paths] = await Promise.all([listReviewQueue(), listPathReviewQueue()]);
  const pending = queue.filter((item) => item.status === "pending").length;
  const pathPending = paths.filter((item) => item.status === "pending").length;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <Link href="/admin" className="text-sm text-zinc-400">
        Admin panel
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Review</h1>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-50">Problems</h2>
        <p className="text-sm text-zinc-400">{pending === 0 ? "Nothing is waiting." : `${pending} waiting.`}</p>
        {queue.map((item) => (
          <Link key={item.id} href={`/review/${item.id}`} className="rounded-lg border border-[#27272A] bg-[#121215] px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
              <span>
                {item.author} · {lessonTypeLabel(item.category)} · {proposalKindLabel(item.kind)}
              </span>
              <span>{item.lessonNumber ? `#${item.lessonNumber}` : STATUS[item.status]}</span>
            </div>
            <div className="mt-1 text-sm text-zinc-100">
              {item.label} · {item.title}
            </div>
          </Link>
        ))}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-50">Learning paths</h2>
        <p className="text-sm text-zinc-400">{pathPending === 0 ? "Nothing is waiting." : `${pathPending} waiting.`}</p>
        {paths.map((item) => (
          <Link key={item.id} href={`/review/path/${item.id}`} className="rounded-lg border border-[#27272A] bg-[#121215] px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
              <span>
                {item.author} · {formatProblemCount(item.lessonNumbers.length)}
              </span>
              <span>{STATUS[item.status]}</span>
            </div>
            <div className="mt-1 text-sm text-zinc-100">{item.topic}</div>
          </Link>
        ))}
      </section>
    </main>
  );
}
