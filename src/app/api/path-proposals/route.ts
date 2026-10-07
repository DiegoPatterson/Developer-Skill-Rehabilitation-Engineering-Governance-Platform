import { getViewer } from "@/server/auth";
import { json, logSafe } from "@/server/http";
import { createPathProposal } from "@/server/path-proposals";
import { ProposalError } from "@/server/proposals";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Sign in first." }, 401);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 20_000) return json({ error: "That path is too large." }, 413);
  try {
    const item = await createPathProposal(viewer.id, viewer.role, await request.json());
    return json({ id: item.id, status: item.status }, 201);
  } catch (error) {
    if (error instanceof ProposalError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ error: "That path is incomplete." }, 400);
    logSafe(error);
    return json({ error: "Could not save the path." }, 500);
  }
}
