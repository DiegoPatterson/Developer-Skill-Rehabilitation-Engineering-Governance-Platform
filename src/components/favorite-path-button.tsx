"use client";

import { useRef, useState } from "react";

export function FavoritePathButton({
  pathId,
  topic,
  favorite,
  onChange,
}: {
  pathId: string;
  topic: string;
  favorite: boolean;
  onChange: (favorite: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  async function toggle() {
    if (pendingRef.current) return;
    const next = !favorite;
    pendingRef.current = true;
    setError("");
    setPending(true);
    onChange(next);
    try {
      const response = await fetch("/api/path-favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pathId, favorite: next }),
      });
      if (!response.ok) {
        onChange(!next);
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not update the favorite.");
      }
    } catch {
      onChange(!next);
      setError("Could not update the favorite.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={favorite ? "btn btn-primary" : "btn"}
        aria-pressed={favorite}
        aria-label={favorite ? `Unfavorite ${topic}` : `Favorite ${topic}`}
        disabled={pending}
        onClick={() => void toggle()}
      >
        {favorite ? "Favorited" : "Favorite"}
      </button>
      {error ? <span className="max-w-40 text-right text-xs text-red-300">{error}</span> : null}
    </span>
  );
}
