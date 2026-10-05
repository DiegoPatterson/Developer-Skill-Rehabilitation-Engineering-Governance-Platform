import { resendVerification } from "@/server/auth";
import { json, logSafe, readJson } from "@/server/http";

export async function POST(request: Request) {
  const body = await readJson(request);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  try {
    const result = await resendVerification(String(record.username ?? ""), new URL(request.url).origin);
    if (result === "unconfigured") return json({ error: "Confirmation email is not configured yet." }, 503);
    if (result === "failed") return json({ error: "The confirmation email could not be sent." }, 503);
    return json({ ok: true, message: "If that account is waiting on confirmation, a new message is on its way." });
  } catch (error) {
    logSafe(error);
    return json({ error: "Could not resend the confirmation." }, 500);
  }
}
