import { ProposalPreview } from "@/components/proposal-preview";
import { ReviewDecision } from "@/components/review-decision";
import { canReview } from "@/content/roles";
import { getViewer } from "@/server/auth";
import { getReviewProposal } from "@/server/proposals";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Review problem · Skill Governance" };

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canReview(viewer.role)) redirect("/graph");
  const { id } = await params;
  const loaded = await getReviewProposal(id);
  if (!loaded) notFound();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <Link href="/review" className="text-sm text-zinc-400">
        Review
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">{loaded.item.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {loaded.item.author}
          {loaded.item.lessonNumber ? ` · #${loaded.item.lessonNumber}` : ` · ${loaded.item.status}`}
        </p>
      </div>
      <ProposalPreview draft={loaded.draft} />
      {loaded.item.reviewNote ? <p className="text-sm text-zinc-400">{loaded.item.reviewNote}</p> : null}
      {loaded.item.status === "pending" ? <ReviewDecision id={loaded.item.id} /> : null}
      {loaded.item.status === "approved" && loaded.item.nodeId ? (
        <Link className="text-sm text-[#4ADE80]" href={`/challenge/${loaded.item.nodeId}`}>
          Open the lesson
        </Link>
      ) : null}
    </main>
  );
}
