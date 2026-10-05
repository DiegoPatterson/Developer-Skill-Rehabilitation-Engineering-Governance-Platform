import { confirmEmail } from "@/server/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Confirm email · Skill Governance" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const confirmed = token ? await confirmEmail(token) : false;
  if (confirmed) redirect("/login?verified=1");
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">This link is invalid or expired</h1>
      <p className="text-sm text-zinc-400">Request a new confirmation from the sign-in page. Links last 24 hours and work once.</p>
      <Link href="/login" className="text-[#4ADE80]">
        Back to sign in
      </Link>
    </main>
  );
}
