import { Workspace } from "@/components/workspace";
import { getViewer } from "@/server/auth";
import { loadWorkspace } from "@/server/workspace";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Outage · Skill Governance" };

export default async function OutagePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const loaded = await loadWorkspace(viewer.id, "incident-ledger");
  if (!loaded) notFound();
  return <Workspace view={loaded.view} attempt={loaded.attempt} />;
}
