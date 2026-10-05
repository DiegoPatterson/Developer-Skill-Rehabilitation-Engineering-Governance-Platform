import { createSource } from "@/content/source";
import { getViewer } from "@/server/auth";
import { json, logSafe, readJson } from "@/server/http";
import { isLocked } from "@/server/outcome";
import { createStore } from "@/server/store";
import { z } from "zod";

const bodySchema = z.object({ nodeId: z.string().regex(/^[a-z0-9-]{1,100}$/) });

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Sign in required." }, 401);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid challenge." }, 400);
  const challenge = createSource().get(parsed.data.nodeId);
  if (!challenge) return json({ error: "Unknown challenge." }, 404);
  try {
    const store = createStore();
    const mastered = await store.masteredIds(viewer.id);
    if (isLocked(challenge.kind, challenge.prereqs, mastered)) return json({ error: "This node is locked." }, 403);
    const revealed = await store.revealHint(viewer.id, challenge.id);
    return json(revealed);
  } catch (error) {
    logSafe(error);
    return json({ error: "Could not reveal a hint." }, 500);
  }
}
