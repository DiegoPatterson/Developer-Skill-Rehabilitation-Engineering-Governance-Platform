import { getViewer } from "@/server/auth";
import { json, logSafe } from "@/server/http";
import { ProposalError, updateProposal } from "@/server/proposals";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Sign in first." }, 401);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 100_000) return json({ error: "That problem is too large." }, 413);
  const { id } = await context.params;
  try {
    const item = await updateProposal(viewer.id, id, await request.json());
    return json({ id: item.id, status: item.status });
  } catch (error) {
    if (error instanceof ProposalError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ error: "That problem is incomplete." }, 400);
    logSafe(error);
    return json({ error: "Could not save the problem." }, 500);
  }
}
