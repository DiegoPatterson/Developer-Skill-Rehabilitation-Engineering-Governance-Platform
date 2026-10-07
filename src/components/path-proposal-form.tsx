"use client";

import { lessonTypeLabel } from "@/content/lesson";
import { formatPathDifficulty, formatProblemCount } from "@/content/paths";
import type { PathDraft, PathLessonChoice } from "@/content/path-proposal";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function PathProposalForm({
  lessons,
  initial,
  proposalId,
}: {
  lessons: PathLessonChoice[];
  initial?: PathDraft;
  proposalId?: string;
}) {
  const router = useRouter();
  const byNumber = useMemo(() => new Map(lessons.map((lesson) => [lesson.number, lesson])), [lessons]);
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [numbers, setNumbers] = useState<number[]>(initial?.lessonNumbers ?? []);
  const [pick, setPick] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const available = lessons.filter((lesson) => !numbers.includes(lesson.number));
  const levels = numbers.map((number) => byNumber.get(number)?.difficulty).filter((level): level is number => level != null);

  function addLesson() {
    const number = Number(pick);
    if (!byNumber.has(number) || numbers.includes(number)) return;
    setNumbers((current) => [...current, number]);
    setPick("");
  }

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= numbers.length) return;
    setNumbers((current) => {
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  async function submit() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(proposalId ? `/api/path-proposals/${proposalId}` : "/api/path-proposals", {
        method: proposalId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, description, lessonNumbers: numbers }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; id?: string } | null;
      if (!response.ok || !body?.id) {
        setError(body?.error ?? "Could not save the path.");
        setPending(false);
        return;
      }
      router.push(`/propose/path?id=${body.id}`);
      router.refresh();
    } catch {
      setError("Could not save the path.");
      setPending(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-zinc-300">
        Topic
        <input className="field" value={topic} maxLength={40} onChange={(event) => setTopic(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-zinc-300">
        Description
        <textarea className="field min-h-24" value={description} maxLength={400} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-zinc-300">Lessons, in order</p>
        <div className="flex flex-wrap gap-2">
          <select className="field min-w-0 flex-1" aria-label="Lesson to add" value={pick} onChange={(event) => setPick(event.target.value)}>
            <option value="">Choose a lesson</option>
            {available.map((lesson) => (
              <option key={lesson.number} value={lesson.number}>
                #{lesson.number} {lesson.title} · {lessonTypeLabel(lesson.category)} · {lesson.difficulty}
              </option>
            ))}
          </select>
          <button className="btn" type="button" disabled={!pick} onClick={addLesson}>
            Add
          </button>
        </div>
        {numbers.length === 0 ? <p className="text-sm text-zinc-500">No lessons yet.</p> : null}
        <ol className="flex flex-col gap-2">
          {numbers.map((number, index) => {
            const lesson = byNumber.get(number);
            return (
              <li key={`${number}-${index}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#27272A] bg-[#121215] px-3 py-2">
                <span className="w-6 font-mono text-xs text-zinc-500">{index + 1}</span>
                <span className="min-w-0 flex-1 text-sm text-zinc-100">
                  {lesson ? `#${lesson.number} ${lesson.title}` : `#${number} is not in the lesson list`}
                </span>
                <button className="btn" type="button" disabled={index === 0} onClick={() => move(index, -1)}>
                  Up
                </button>
                <button className="btn" type="button" disabled={index === numbers.length - 1} onClick={() => move(index, 1)}>
                  Down
                </button>
                <button className="btn" type="button" onClick={() => setNumbers((current) => current.filter((_, item) => item !== index))}>
                  Remove
                </button>
              </li>
            );
          })}
        </ol>
        <p className="font-mono text-xs text-zinc-500">
          {formatProblemCount(numbers.length)} · Difficulty {formatPathDifficulty(levels)}
        </p>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button className="btn btn-primary w-fit" type="submit" disabled={pending}>
        {pending ? "Saving…" : proposalId ? "Save and send back for review" : "Submit for review"}
      </button>
    </form>
  );
}
