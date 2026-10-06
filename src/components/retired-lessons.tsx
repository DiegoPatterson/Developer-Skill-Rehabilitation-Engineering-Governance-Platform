"use client";

import { formatLessonNumber, lessonTypeLabel } from "@/content/lesson";
import type { RetiredLesson } from "@/content/view-model";
import { useRouter } from "next/navigation";
import { useState } from "react";

async function patchCatalog(id: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`/api/catalog/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error ?? "Could not update the lesson.");
}

export function RetiredLessons({ lessons }: { lessons: RetiredLesson[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  async function restore(id: string) {
    setBusy(id);
    setNotice("");
    try {
      await patchCatalog(id, { active: true });
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not restore the lesson.");
    } finally {
      setBusy("");
    }
  }

  if (lessons.length === 0) {
    return <p className="text-sm text-zinc-400">No retired lessons.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {notice ? <p className="text-sm text-red-300">{notice}</p> : null}
      <ul className="flex flex-col gap-3">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#27272A] bg-[#121215] px-3 py-3">
            <div>
              <div className="text-sm text-zinc-100">
                {lesson.number > 0 ? formatLessonNumber(lesson.number) : "Unnumbered"} {lesson.title}
              </div>
              <div className="mt-1 text-xs text-zinc-500">{lessonTypeLabel(lesson.category)}</div>
            </div>
            <button className="btn" type="button" disabled={busy === lesson.id} onClick={() => void restore(lesson.id)}>
              Restore
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
