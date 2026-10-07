import { getViewer } from "@/server/auth";
import { json, logSafe } from "@/server/http";
import { decidePathProposal } from "@/server/path-proposals";
import { ProposalError } from "@/server/proposals";
import { z } from "zod";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(1000).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Sign in first." }, 401);
  const { id } = await context.params;
  try {
    const body = bodySchema.safeParse(await request.json());
    if (!body.success) return json({ error: "Choose approve or reject." }, 400);
    const item = await decidePathProposal(viewer.id, viewer.role, id, body.data.action, body.data.note ?? "");
    return json({ id: item.id, status: item.status });
  } catch (error) {
    if (error instanceof ProposalError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ error: "Choose approve or reject." }, 400);
    logSafe(error);
    return json({ error: "Could not review the path." }, 500);
  }
}
