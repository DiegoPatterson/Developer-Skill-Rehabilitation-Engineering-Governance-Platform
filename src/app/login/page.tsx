import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in · Skill Governance" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ verified?: string }> }) {
  const params = await searchParams;
  return <AuthForm mode="login" verified={params.verified === "1"} />;
}
