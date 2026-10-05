import { registerAccount } from "@/server/auth";
import { json, logSafe, readJson } from "@/server/http";

export async function POST(request: Request) {
  const body = await readJson(request);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  try {
    const result = await registerAccount({
      username: String(record.username ?? ""),
      email: String(record.email ?? ""),
      password: String(record.password ?? ""),
      confirmPassword: String(record.confirmPassword ?? ""),
      origin: new URL(request.url).origin,
    });
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ ok: true, verificationRequired: true });
  } catch (error) {
    logSafe(error);
    return json({ error: "Could not register." }, 500);
  }
}
