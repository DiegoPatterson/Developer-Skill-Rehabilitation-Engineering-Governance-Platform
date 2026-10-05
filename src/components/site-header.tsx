"use client";

import type { SkillLink } from "@/content/view-model";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader({
  username,
  overallElo,
  streak,
  shields,
  skills,
}: {
  username: string;
  overallElo: number;
  streak: number;
  shields: number;
  skills: SkillLink[];
}) {
  const pathname = usePathname();
  const challengeId = pathname.startsWith("/challenge/") ? pathname.slice("/challenge/".length) : "";
  const skill = skills.find((item) => item.id === challengeId);
  const section = pathname.startsWith("/dashboard")
    ? "Dashboard"
    : pathname.startsWith("/account")
      ? "Account"
      : pathname.startsWith("/outage")
        ? "Outage"
        : pathname.startsWith("/challenge/")
          ? (skill?.title ?? "Challenge")
          : "Graph";

  const link = (href: string, label: string) => {
    const active = href === "/graph" ? pathname === "/graph" : pathname.startsWith(href);
    return (
      <Link href={href} className={active ? "text-[#4ADE80]" : "text-zinc-400 hover:text-zinc-200"}>
        {label}
      </Link>
    );
  };

  return (
    <header className="flex h-14 items-center gap-4 border-b border-[#27272A] bg-[#09090B] px-4">
      <Link href="/graph" className="font-semibold text-zinc-50">
        Skill Governance
      </Link>
      <nav className="flex gap-4 text-sm">
        {link("/graph", "Graph")}
        {link("/dashboard", "Dashboard")}
        {link("/outage", "Outage")}
      </nav>
      <p className="hidden min-w-0 flex-1 truncate text-sm text-zinc-500 md:block">
        <Link href="/graph" className="hover:text-zinc-300">
          Graph
        </Link>
        {section !== "Graph" ? <span> / {section}</span> : null}
      </p>
      <p className="ml-auto font-mono text-xs text-zinc-400">
        Streak {streak} · Shields {shields} · ELO {overallElo}
      </p>
      <Link href="/account" className="max-w-[10rem] truncate text-sm text-zinc-200 underline decoration-[#27272A]">
        {username}
      </Link>
    </header>
  );
}
