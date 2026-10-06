import { canReview } from "@/content/roles";
import { updateCatalogNode, CatalogError, type CatalogPatch } from "@/server/catalog";
import { getViewer } from "@/server/auth";
import { json, logSafe } from "@/server/http";
import { z } from "zod";

const bodySchema = z
  .object({
    showInGraph: z.boolean().optional(),
    active: z.boolean().optional(),
    positionX: z.number().finite().nullable().optional(),
    positionY: z.number().finite().nullable().optional(),
  })
  .strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Sign in first." }, 401);
  if (!canReview(viewer.role)) return json({ error: "Only an admin can change lessons." }, 403);
  const { id } = await context.params;
  try {
    const body = bodySchema.safeParse(await request.json());
    if (!body.success) return json({ error: "That lesson change is not valid." }, 400);
    const patch: CatalogPatch = body.data;
    await updateCatalogNode(viewer.role, id, patch);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof CatalogError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ error: "That lesson change is not valid." }, 400);
    logSafe(error);
    return json({ error: "Could not update the lesson." }, 500);
  }
}
