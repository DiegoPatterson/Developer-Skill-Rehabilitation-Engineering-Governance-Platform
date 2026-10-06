"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewDecision({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);

  async function send(action: "approve" | "reject") {
    setPending(action);
    setError("");
    try {
      const response = await fetch(`/api/proposals/${id}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const body = (await response.json()) as { error?: string; lessonNumber?: number | null };
      if (!response.ok) {
        setError(body.error ?? "Could not review the problem.");
        setPending(null);
        return;
      }
      router.push("/review");
      router.refresh();
    } catch {
      setError("Could not review the problem.");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-zinc-300">
        Note
        <textarea className="field min-h-24" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
      </label>
      <p className="text-xs text-zinc-500">Accepting assigns the next lesson number. A rejection needs a note.</p>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" type="button" disabled={pending !== null} onClick={() => send("approve")}>
          {pending === "approve" ? "Accepting…" : "Accept"}
        </button>
        <button className="btn" type="button" disabled={pending !== null} onClick={() => send("reject")}>
          {pending === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </div>
  );
}
