import { SiteHeader } from "@/components/site-header";
import { skillLinks } from "@/content/view";
import { createSource } from "@/content/source";
import { getViewer } from "@/server/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return (
    <div className="min-h-full">
      <SiteHeader
        username={viewer.username}
        overallElo={viewer.overallElo}
        streak={viewer.currentStreak}
        shields={viewer.shields}
        skills={skillLinks(createSource().list())}
      />
      {children}
    </div>
  );
}
