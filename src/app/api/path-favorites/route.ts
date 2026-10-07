import { getViewer } from "@/server/auth";
import { setPathFavorite } from "@/server/path-favorites";
import { json, logSafe } from "@/server/http";
import { ProposalError } from "@/server/proposals";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Sign in first." }, 401);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2_000) return json({ error: "That favorite is incomplete." }, 413);
  try {
    await setPathFavorite(viewer.id, await request.json());
    return json({ ok: true });
  } catch (error) {
    if (error instanceof ProposalError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ error: "That favorite is incomplete." }, 400);
    logSafe(error);
    return json({ error: "Could not update the favorite." }, 500);
  }
}
