import "server-only";

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function isHttps(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  return new URL(request.url).protocol === "https:";
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function logSafe(error: unknown): void {
  const name = error instanceof Error ? error.name : "unknown";
  console.error("request failed", name);
}
