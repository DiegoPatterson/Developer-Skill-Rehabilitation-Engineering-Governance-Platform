import { SESSION_COOKIE, loginAccount, sessionCookieOptions } from "@/server/auth";
import { isHttps, json, logSafe, readJson } from "@/server/http";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const body = await readJson(request);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  try {
    const result = await loginAccount({
      username: String(record.username ?? ""),
      password: String(record.password ?? ""),
    });
    if (!result.ok || !result.token) return json({ error: result.ok ? "Could not sign in." : result.error }, result.ok ? 500 : result.status);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, result.token, sessionCookieOptions(isHttps(request)));
    return json({ ok: true });
  } catch (error) {
    logSafe(error);
    return json({ error: "Could not sign in." }, 500);
  }
}
