import { ReviewDecision } from "@/components/review-decision";
import { lessonTypeLabel } from "@/content/lesson";
import { formatPathDifficulty, formatProblemCount } from "@/content/paths";
import { canReview } from "@/content/roles";
import { getViewer } from "@/server/auth";
import { getReviewPath, pathLessonChoices } from "@/server/path-proposals";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Review path · Skill Governance" };

export default async function ReviewPathPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canReview(viewer.role)) redirect("/lessons");
  const { id } = await params;
  const item = await getReviewPath(id);
  if (!item) notFound();
  const byNumber = new Map(pathLessonChoices().map((lesson) => [lesson.number, lesson]));
  const levels = item.lessonNumbers.map((number) => byNumber.get(number)?.difficulty).filter((level): level is number => level != null);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <Link href="/review" className="text-sm text-zinc-400">
        Review
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">{item.topic}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {item.author} · {formatProblemCount(item.lessonNumbers.length)} · Difficulty {formatPathDifficulty(levels)} · {item.status}
        </p>
        <p className="mt-3 text-sm text-zinc-300">{item.description}</p>
      </div>
      <ol className="flex flex-col gap-2">
        {item.lessonNumbers.map((number, index) => {
          const lesson = byNumber.get(number);
          return (
            <li key={`${number}-${index}`} className="rounded-lg border border-[#27272A] bg-[#121215] px-3 py-2 text-sm text-zinc-100">
              {index + 1}. #{number} {lesson ? lesson.title : "is not in the lesson list"}
              {lesson ? <span className="text-zinc-500"> · {lessonTypeLabel(lesson.category)} · {lesson.difficulty}</span> : null}
            </li>
          );
        })}
      </ol>
      {item.reviewNote ? <p className="text-sm text-zinc-400">{item.reviewNote}</p> : null}
      {item.status === "pending" ? (
        <ReviewDecision
          id={item.id}
          endpoint={`/api/path-proposals/${item.id}/decide`}
          hint="Accepting publishes this path on Learning. A rejection needs a note."
        />
      ) : null}
      {item.status === "approved" ? (
        <Link className="text-sm text-[#4ADE80]" href="/learn">
          Open Learning
        </Link>
      ) : null}
    </main>
  );
}
