import { ProposalForm } from "@/components/proposal-form";
import { lessonTypeLabel } from "@/content/lesson";
import { proposalKindLabel } from "@/content/proposal";
import { getViewer } from "@/server/auth";
import { getMyProposal, listMyProposals } from "@/server/proposals";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Propose · Skill Governance" };

const STATUS = { pending: "Pending", approved: "Accepted", rejected: "Rejected" };

export default async function ProposePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { id } = await searchParams;
  const mine = await listMyProposals(viewer.id);
  const editing = id ? await getMyProposal(viewer.id, id) : null;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Propose a problem</h1>
        <p className="mt-2 text-sm text-zinc-400">
          A problem stays pending until an admin accepts it. The lesson number is assigned then. The reference solution and the answer key stay hidden from players.
        </p>
      </div>
      {id && !editing ? <p className="text-sm text-zinc-400">That problem was not found.</p> : null}
      {editing?.item.status === "approved" ? (
        <p className="text-sm text-zinc-300">
          Accepted as #{editing.item.lessonNumber}.{" "}
          <Link className="text-[#4ADE80]" href={`/challenge/${editing.item.nodeId}`}>
            Open the lesson
          </Link>
        </p>
      ) : (
        <ProposalForm initial={editing?.draft} proposalId={editing?.item.id} />
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-50">Your problems</h2>
        {mine.length === 0 ? <p className="text-sm text-zinc-500">Nothing submitted yet.</p> : null}
        {mine.map((item) => (
          <Link key={item.id} href={`/propose?id=${item.id}`} className="rounded-lg border border-[#27272A] bg-[#121215] px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
              <span>
                {lessonTypeLabel(item.category)} · {proposalKindLabel(item.kind)}
              </span>
              <span>{item.lessonNumber ? `#${item.lessonNumber}` : STATUS[item.status]}</span>
            </div>
            <div className="mt-1 text-sm text-zinc-100">
              {item.label} · {item.title}
            </div>
            {item.reviewNote ? <p className="mt-2 text-xs text-zinc-400">{item.reviewNote}</p> : null}
          </Link>
        ))}
      </section>
    </main>
  );
}
