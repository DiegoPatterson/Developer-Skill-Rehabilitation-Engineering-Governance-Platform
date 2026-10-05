import { SESSION_COOKIE, logoutAccount, sessionCookieOptions } from "@/server/auth";
import { isHttps, json, logSafe } from "@/server/http";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    await logoutAccount();
    const jar = await cookies();
    jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(isHttps(request)), maxAge: 0 });
    return json({ ok: true });
  } catch (error) {
    logSafe(error);
    return json({ error: "Could not sign out." }, 500);
  }
}
