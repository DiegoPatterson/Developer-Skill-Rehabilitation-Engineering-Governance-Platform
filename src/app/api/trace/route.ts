import { traceIssued } from "@/content/evaluate";
import { createSource } from "@/content/source";
import { getViewer } from "@/server/auth";
import { json, logSafe, readJson } from "@/server/http";
import { isLocked } from "@/server/outcome";
import { createStore } from "@/server/store";
import { z } from "zod";

const bodySchema = z.object({
  nodeId: z.string().regex(/^[a-z0-9-]{1,100}$/),
  scenarioId: z.string().max(80),
});

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Sign in required." }, 401);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid trace request." }, 400);
  const challenge = createSource().get(parsed.data.nodeId);
  if (!challenge) return json({ error: "Unknown challenge." }, 404);
  try {
    const store = createStore();
    const mastered = await store.masteredIds(viewer.id);
    if (isLocked(challenge.kind, challenge.prereqs, mastered)) return json({ error: "This node is locked." }, 403);
    const frames = await traceIssued(challenge, parsed.data.scenarioId);
    return json({ frames: Array.isArray(frames) ? frames : [] });
  } catch (error) {
    logSafe(error);
    return json({ error: "Could not trace the issued snippet." }, 500);
  }
}
