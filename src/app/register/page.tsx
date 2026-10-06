import { AuthForm } from "@/components/auth-form";
import { getViewer } from "@/server/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Register · Skill Governance" };

export default async function RegisterPage() {
  const viewer = await getViewer();
  if (viewer) redirect("/lessons");
  return <AuthForm mode="register" />;
}
