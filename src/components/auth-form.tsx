"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      className="btn"
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void fetch("/api/auth/logout", { method: "POST" }).then(() => {
          router.push("/login");
          router.refresh();
        });
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function AuthForm({ mode, verified = false }: { mode: "login" | "register"; verified?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(verified ? "Email confirmed. Sign in with your username and password." : "");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (mode === "register" && password !== String(form.get("confirmPassword") ?? "")) {
      setError("Passwords do not match.");
      setPending(false);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next") ?? "/lessons";
    const safeNext = /^\/[A-Za-z0-9/_-]*$/.test(next) ? next : "/lessons";
    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: String(form.get("username") ?? ""),
          email: String(form.get("email") ?? ""),
          password,
          confirmPassword: String(form.get("confirmPassword") ?? ""),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; verificationRequired?: boolean };
      if (!response.ok) {
        setError(data.error ?? "Request failed.");
        setPending(false);
        return;
      }
      if (data.verificationRequired) {
        setNotice("Check your email for a confirmation link from strayapps.co@gmail.com. Then sign in.");
        setPending(false);
        return;
      }
      router.push(safeNext);
      router.refresh();
    } catch {
      setError("Request failed.");
      setPending(false);
    }
  }

  return (
    <form id="auth-form" onSubmit={onSubmit} className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#4ADE80]">Skill Governance</p>
      <h1 className="text-2xl font-semibold text-zinc-50">{mode === "login" ? "Sign in" : "Create an account"}</h1>
      <label className="flex flex-col gap-1 text-sm text-zinc-400">
        Username
        <input className="field" name="username" autoComplete="username" required minLength={3} maxLength={20} />
      </label>
      {mode === "register" ? (
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Email
          <input className="field" name="email" type="email" autoComplete="email" required />
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm text-zinc-400">
        Password
        <input className="field" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={10} />
      </label>
      {mode === "register" ? (
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Confirm password
          <input className="field" name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} />
        </label>
      ) : null}
      {notice ? <p className="text-sm text-[#4ADE80]">{notice}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {mode === "login" && error.includes("Confirm your email") ? (
        <button
          className="btn"
          type="button"
          disabled={pending}
          onClick={() => {
            const form = document.getElementById("auth-form");
            const username = form instanceof HTMLFormElement ? String(new FormData(form).get("username") ?? "") : "";
            setPending(true);
            void fetch("/api/auth/resend", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ username }),
            })
              .then(async (response) => {
                const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
                if (!response.ok) setError(data.error ?? "Could not resend.");
                else setNotice(data.message ?? "If that account is waiting on confirmation, a new message is on its way.");
              })
              .finally(() => setPending(false));
          }}
        >
          Resend confirmation
        </button>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
      <p className="text-sm text-zinc-500">
        {mode === "login" ? (
          <Link href="/register" className="text-[#4ADE80]">
            Create an account
          </Link>
        ) : (
          <Link href="/login" className="text-[#4ADE80]">
            Sign in
          </Link>
        )}
      </p>
    </form>
  );
}
