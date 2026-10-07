import { PathProposalForm } from "@/components/path-proposal-form";
import { formatProblemCount } from "@/content/paths";
import { canReview } from "@/content/roles";
import { getViewer } from "@/server/auth";
import { getMyPathProposal, listMyPathProposals, pathLessonChoices } from "@/server/path-proposals";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Propose a path · Skill Governance" };

const STATUS = { pending: "Pending", approved: "Accepted", rejected: "Rejected" };

export default async function ProposePathPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canReview(viewer.role)) redirect("/lessons");
  const { id } = await searchParams;
  const mine = await listMyPathProposals(viewer.id);
  const editing = id ? await getMyPathProposal(viewer.id, id) : null;
  const lessons = pathLessonChoices();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <Link href="/admin" className="text-sm text-zinc-400">
        Admin panel
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Propose a learning path</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Pick lessons and put them in order. Accepting the path from Review publishes it on Learning. Difficulty follows the lessons you choose.
        </p>
      </div>
      {id && !editing ? <p className="text-sm text-zinc-400">That path was not found.</p> : null}
      {editing?.item.status === "approved" ? (
        <p className="text-sm text-zinc-300">
          Accepted. It is on <Link className="text-[#4ADE80]" href="/learn">Learning</Link>.
        </p>
      ) : (
        <PathProposalForm lessons={lessons} initial={editing?.draft} proposalId={editing?.item.id} />
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-50">Your paths</h2>
        {mine.length === 0 ? <p className="text-sm text-zinc-500">Nothing submitted yet.</p> : null}
        {mine.map((item) => (
          <Link key={item.id} href={`/propose/path?id=${item.id}`} className="rounded-lg border border-[#27272A] bg-[#121215] px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
              <span>{formatProblemCount(item.lessonNumbers.length)}</span>
              <span>{STATUS[item.status]}</span>
            </div>
            <div className="mt-1 text-sm text-zinc-100">{item.topic}</div>
            {item.reviewNote ? <p className="mt-2 text-xs text-zinc-400">{item.reviewNote}</p> : null}
          </Link>
        ))}
      </section>
    </main>
  );
}
