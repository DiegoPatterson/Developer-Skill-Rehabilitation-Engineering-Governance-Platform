import { formatElo } from "@/engine/elo";
import { getViewer } from "@/server/auth";
import { createStore } from "@/server/store";
import Link from "next/link";
import { redirect } from "next/navigation";

const CATEGORY_LABELS: Record<string, string> = {
  debugging: "Debugging",
  security: "Security",
  comprehension: "Comprehension",
  performance: "Performance",
  architecture: "Architecture",
  ml: "ML",
};

export const metadata = { title: "Dashboard · Skill Governance" };

function formatMs(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function heatColor(count: number, empty: boolean): string {
  if (empty) return "transparent";
  if (count <= 0) return "#18181b";
  if (count === 1) return "#064e3b";
  if (count <= 3) return "#047857";
  return "#10b981";
}

export default async function DashboardPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const data = await createStore().dashboard(viewer.id);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">{data.solved} nodes mastered · longest streak {viewer.longestStreak}</p>
      </div>
      <section>
        <h2 className="text-xs uppercase tracking-wide text-zinc-500">Last 16 weeks</h2>
        <div className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px]" style={{ width: "max-content" }}>
          {data.heatmap.map((cell, index) => (
            <div
              key={`${cell.date}-${index}`}
              title={cell.date ? `${cell.date}: ${cell.count}` : ""}
              className="h-3 w-3 rounded-[2px]"
              style={{ background: heatColor(cell.count, cell.date === "") }}
            />
          ))}
        </div>
      </section>
      <section className="grid gap-3">
        {data.elos.map((row) => (
          <div key={row.category} className="grid grid-cols-[140px_1fr_48px] items-center gap-3 text-sm">
            <span className="text-zinc-400">{CATEGORY_LABELS[row.category] ?? row.category}</span>
            <div className="h-2 rounded bg-zinc-800">
              <div
                className="h-full rounded bg-[#10B981]"
                style={{ width: row.rated ? `${Math.min(100, (row.elo / 2000) * 100)}%` : "0%" }}
              />
            </div>
            <span className="font-mono text-zinc-300">{formatElo(row.elo, row.rated)}</span>
          </div>
        ))}
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-[#27272A] bg-[#121215] p-4">
          <h2 className="text-xs uppercase tracking-wide text-zinc-500">Median time to fix, last 20 passes</h2>
          <p className="mt-2 font-mono text-2xl text-zinc-50">
            {data.medianTimeToFixMs == null ? "—" : formatMs(data.medianTimeToFixMs)}
          </p>
        </div>
        <div className="rounded-md border border-[#27272A] bg-[#121215] p-4">
          <h2 className="text-xs uppercase tracking-wide text-zinc-500">Mean review precision</h2>
          <p className="mt-2 font-mono text-2xl text-zinc-50">
            {data.meanReviewPrecision == null ? "—" : data.meanReviewPrecision.toFixed(2)}
          </p>
        </div>
      </section>
      <section>
        <h2 className="text-xs uppercase tracking-wide text-zinc-500">Recent submissions</h2>
        {data.recent.length === 0 ? <p className="mt-3 text-sm text-zinc-500">No submissions yet.</p> : null}
        <ul className="mt-3 divide-y divide-[#27272A] border-y border-[#27272A]">
          {data.recent.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
              <Link href={row.nodeId === "incident-ledger" ? "/outage" : `/challenge/${row.nodeId}`} className="text-zinc-200">
                {row.title}
              </Link>
              <span className="font-mono text-xs text-zinc-500">
                {row.category} · {row.passed ? "pass" : "fail"} · {row.score ?? "—"} · {new Date(row.submittedAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
