import { getViewer } from "@/server/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const viewer = await getViewer();
  if (viewer) redirect("/lessons");
  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#4ADE80]">Skill Governance</p>
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-50">
        Developer Skill Rehabilitation & Engineering Governance
      </h1>
      <p className="max-w-2xl text-lg leading-8 text-zinc-400">
        Practice the work a senior does after the draft exists: patch a wrong function, trace state, review a pull request,
        write the spec before the code, and choose a model you can afford. Every challenge is curated and executed. A run
        does not move your rating. A submit does.
      </p>
      <ul className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
        <li className="rounded-md border border-[#27272A] bg-[#121215] px-3 py-2">Debugging and state</li>
        <li className="rounded-md border border-[#27272A] bg-[#121215] px-3 py-2">Security and supply chain</li>
        <li className="rounded-md border border-[#27272A] bg-[#121215] px-3 py-2">Comprehension and review</li>
        <li className="rounded-md border border-[#27272A] bg-[#121215] px-3 py-2">Performance and data access</li>
        <li className="rounded-md border border-[#27272A] bg-[#121215] px-3 py-2">Architecture and governance</li>
        <li className="rounded-md border border-[#27272A] bg-[#121215] px-3 py-2">Model choice, leakage, and cost</li>
      </ul>
      <div className="flex gap-3">
        <Link href="/register" className="btn btn-primary inline-flex items-center">
          Create account
        </Link>
        <Link href="/login" className="btn inline-flex items-center">
          Sign in
        </Link>
      </div>
    </main>
  );
}
