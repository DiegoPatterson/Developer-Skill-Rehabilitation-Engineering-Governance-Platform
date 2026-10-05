import { LogoutButton } from "@/components/auth-form";
import { getViewer } from "@/server/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Account · Skill Governance" };

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const rows = [
    ["Username", viewer.username],
    ["Email", viewer.email],
    ["Joined", new Date(viewer.createdAt).toLocaleDateString()],
    ["Overall ELO", String(viewer.overallElo)],
    ["Streak", String(viewer.currentStreak)],
    ["Longest streak", String(viewer.longestStreak)],
    ["Shields", String(viewer.shields)],
    ["Nodes mastered", String(viewer.totalChallengesSolved)],
  ];
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-50">Account</h1>
      <dl className="divide-y divide-[#27272A] border-y border-[#27272A]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2 text-sm">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="text-zinc-200">{value}</dd>
          </div>
        ))}
      </dl>
      <LogoutButton />
    </main>
  );
}
