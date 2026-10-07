"use client";

import { formatRun, type ShownSubmission } from "@/content/submissions";
import { useState } from "react";

export type BoardRow = {
  id: string;
  username: string;
  you: boolean;
  score: number | null;
  executionTimeMs: number | null;
  hintsUsed: number;
  when: string;
};

export type OwnRow = BoardRow & {
  passed: boolean;
  shown: ShownSubmission;
};

function hintLabel(count: number): string {
  return `${count} ${count === 1 ? "hint" : "hints"}`;
}

function metrics(row: BoardRow): string {
  return `Score ${row.score ?? "—"} · Runtime ${formatRun(row.executionTimeMs)} · ${hintLabel(row.hintsUsed)}`;
}

function ShownWork({ shown }: { shown: ShownSubmission }) {
  if (shown.files.length === 0 && shown.notes.length === 0) {
    return <p className="text-sm text-zinc-500">No answer was stored with this submission.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {shown.files.map((file) => (
        <div key={file.name}>
          <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{file.name}</div>
          <pre className="mt-1 max-h-80 overflow-auto rounded-md border border-[#27272A] bg-[#09090B] p-3 font-mono text-xs text-zinc-200">{file.text}</pre>
        </div>
      ))}
      {shown.notes.map((note, index) => (
        <div key={`${note.label}-${index}`}>
          <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{note.label}</div>
          <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs text-zinc-300">{note.text}</pre>
        </div>
      ))}
    </div>
  );
}

export function SubmissionBoard({ board, yours }: { board: BoardRow[]; yours: OwnRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-xs uppercase tracking-wide text-zinc-500">Most optimal</h2>
        <p className="mt-2 text-sm text-zinc-400">One best passing attempt per person. Highest score, then fastest run, then fewest hints.</p>
        {board.length === 0 ? <p className="mt-3 text-sm text-zinc-500">No passing submission yet.</p> : null}
        <ol className="mt-3 flex flex-col gap-2">
          {board.map((row, index) => (
            <li
              key={row.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border px-3 py-3"
              style={{
                background: index === 0 ? "#052e16" : "#121215",
                borderColor: index === 0 ? "#10B981" : "#27272A",
              }}
            >
              <div className="min-w-0">
                <div className="text-sm text-zinc-100">
                  <span className="font-mono text-xs text-zinc-500">{index + 1}</span> {row.username}
                  {row.you ? <span className="text-zinc-400"> · You</span> : null}
                  {index === 0 ? <span className="text-[#4ADE80]"> · Most optimal</span> : null}
                </div>
                <div className="mt-1 font-mono text-xs text-zinc-400">{metrics(row)}</div>
              </div>
              <div className="font-mono text-[10px] text-zinc-500">{row.when}</div>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="text-xs uppercase tracking-wide text-zinc-500">Your submissions</h2>
        <p className="mt-2 text-sm text-zinc-400">Newest first, including ones that failed.</p>
        {yours.length === 0 ? <p className="mt-3 text-sm text-zinc-500">You have not submitted this lesson.</p> : null}
        <ul className="mt-3 flex flex-col gap-2">
          {yours.map((row) => {
            const open = openId === row.id;
            return (
              <li key={row.id} className="rounded-lg border border-[#27272A] bg-[#121215]">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-baseline justify-between gap-2 px-3 py-3 text-left"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : row.id)}
                >
                  <div>
                    <div className="text-sm text-zinc-100">{row.passed ? "Passed" : "Failed"}</div>
                    <div className="mt-1 font-mono text-xs text-zinc-400">{metrics(row)}</div>
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500">{open ? "Hide" : "Show"} · {row.when}</div>
                </button>
                {open ? (
                  <div className="border-t border-[#27272A] px-3 py-3">
                    <ShownWork shown={row.shown} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
