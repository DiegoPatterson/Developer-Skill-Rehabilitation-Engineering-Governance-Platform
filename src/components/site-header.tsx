"use client";

import { formatLessonNumber } from "@/content/lesson";
import { LESSON_PATHS } from "@/content/paths";
import type { SkillLink } from "@/content/view-model";
import { formatElo } from "@/engine/elo";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader({
  username,
  overallElo,
  rated,
  streak,
  shields,
  skills,
  staff,
}: {
  username: string;
  overallElo: number;
  rated: boolean;
  streak: number;
  shields: number;
  skills: SkillLink[];
  staff: boolean;
}) {
  const pathname = usePathname();
  const challengeParts = pathname.startsWith("/challenge/") ? pathname.slice("/challenge/".length).split("/").filter(Boolean) : [];
  const challengeId = challengeParts[0] ?? "";
  const skill = skills.find((item) => item.id === challengeId);
  const challengeLabel = skill ? `${formatLessonNumber(skill.number)} ${skill.title}` : "Challenge";
  const learnId = pathname.startsWith("/learn/") ? (pathname.slice("/learn/".length).split("/").filter(Boolean)[0] ?? "") : "";
  const learnTopic = LESSON_PATHS.find((path) => path.id === learnId)?.title;
  const inAdmin =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/retired") ||
    pathname.startsWith("/propose/path");
  const adminLeaf = pathname.startsWith("/propose/path")
    ? "Propose a path"
    : pathname.startsWith("/review/path")
      ? "Review path"
      : pathname.startsWith("/review")
        ? "Review"
        : pathname.startsWith("/retired")
          ? "Retired"
          : "";
  const section = pathname.startsWith("/dashboard")
    ? "Dashboard"
    : pathname.startsWith("/account")
      ? "Account"
      : pathname.startsWith("/outage")
        ? `${formatLessonNumber(skills.find((item) => item.id === "incident-ledger")?.number ?? 20)} Outage`
        : inAdmin
          ? adminLeaf
            ? `Admin panel / ${adminLeaf}`
            : "Admin panel"
          : pathname.startsWith("/propose")
            ? "Propose"
            : pathname.startsWith("/learn/")
              ? learnTopic
                ? `Learning / ${learnTopic}`
                : "Learning / Path"
              : pathname.startsWith("/learn")
                ? "Learning"
              : pathname.startsWith("/challenge/")
                ? challengeParts[1] === "submissions"
                  ? `${challengeLabel} / Submissions`
                  : challengeLabel
                : "Lessons";

  const link = (href: string, label: string) => {
    const active =
      href === "/admin"
        ? inAdmin
        : href === "/propose"
          ? pathname === "/propose"
          : pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link href={href} className={active ? "text-[#4ADE80]" : "text-zinc-400 hover:text-zinc-200"}>
        {label}
      </Link>
    );
  };

  return (
    <header className="flex h-14 items-center gap-4 border-b border-[#27272A] bg-[#09090B] px-4">
      <Link href="/lessons" className="font-semibold text-zinc-50">
        Skill Governance
      </Link>
      <nav className="flex min-w-0 gap-4 overflow-x-auto text-sm">
        {link("/lessons", "Lessons")}
        {link("/learn", "Learning")}
        {link("/dashboard", "Dashboard")}
        {link("/outage", "Outage")}
        {link("/propose", "Propose")}
        {staff ? link("/admin", "Admin panel") : null}
      </nav>
      <p className="hidden min-w-0 flex-1 truncate text-sm text-zinc-500 md:block">
        <Link href="/lessons" className="hover:text-zinc-300">
          Lessons
        </Link>
        {section !== "Lessons" ? <span> / {section}</span> : null}
      </p>
      <p className="ml-auto font-mono text-xs text-zinc-400">
        Streak {streak} · Shields {shields} · ELO {formatElo(overallElo, rated)}
      </p>
      <Link href="/account" className="max-w-[10rem] truncate text-sm text-zinc-200 underline decoration-[#27272A]">
        {username}
      </Link>
    </header>
  );
}
