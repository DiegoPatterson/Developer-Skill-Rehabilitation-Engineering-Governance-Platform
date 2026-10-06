import { AuthForm } from "@/components/auth-form";
import { getViewer } from "@/server/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Sign in · Skill Governance" };

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/lessons";
  if (next === "/login" || next.startsWith("/login?") || next === "/register" || next.startsWith("/register?")) return "/lessons";
  return next;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ verified?: string; next?: string }> }) {
  const viewer = await getViewer();
  const params = await searchParams;
  if (viewer) redirect(safeNext(params.next));
  return <AuthForm mode="login" verified={params.verified === "1"} />;
}
