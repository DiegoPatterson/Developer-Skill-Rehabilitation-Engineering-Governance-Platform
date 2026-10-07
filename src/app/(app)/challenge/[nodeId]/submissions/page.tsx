import { SubmissionBoard, type BoardRow, type OwnRow } from "@/components/submission-board";
import { formatLessonNumber } from "@/content/lesson";
import { formatWhen } from "@/content/submissions";
import { getViewer } from "@/server/auth";
import { loadLessonBoard } from "@/server/workspace";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  return { title: `${nodeId} submissions · Skill Governance` };
}

export default async function SubmissionsPage({ params }: { params: Promise<{ nodeId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { nodeId } = await params;
  const loaded = await loadLessonBoard(viewer.id, nodeId);
  if (!loaded) notFound();
  const { challenge, board, yours } = loaded;
  const back = challenge.kind === "incident" ? "/outage" : `/challenge/${challenge.id}`;
  const ranked: BoardRow[] = board.map((row) => ({
    id: row.id,
    username: row.username,
    you: row.userId === viewer.id,
    score: row.score,
    executionTimeMs: row.executionTimeMs,
    hintsUsed: row.hintsUsed,
    when: formatWhen(row.submittedAt),
  }));
  const own: OwnRow[] = yours.map((row) => ({
    id: row.id,
    username: row.username,
    you: true,
    passed: row.passed,
    score: row.score,
    executionTimeMs: row.executionTimeMs,
    hintsUsed: row.hintsUsed,
    when: formatWhen(row.submittedAt),
    shown: row.shown,
  }));
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">
          {formatLessonNumber(challenge.number)} · {challenge.category}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">{challenge.title}</h1>
        <p className="mt-2 text-sm text-zinc-400">Passing work is ranked by person. Your own attempts stay in a separate list.</p>
        <Link href={back} className="mt-3 inline-block text-sm text-[#4ADE80]">
          Back to the lesson
        </Link>
      </div>
      <SubmissionBoard board={ranked} yours={own} />
    </main>
  );
}
