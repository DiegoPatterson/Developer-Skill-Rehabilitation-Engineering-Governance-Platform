import { createSource } from "@/content/source";
import { getViewer } from "@/server/auth";
import { json, logSafe, readJson } from "@/server/http";
import { createStore } from "@/server/store";
import { z } from "zod";

const bodySchema = z.object({ nodeId: z.string().regex(/^[a-z0-9-]{1,100}$/) });

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Sign in required." }, 401);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid challenge." }, 400);
  const challenge = createSource().get(parsed.data.nodeId);
  if (!challenge || challenge.kind !== "incident") return json({ error: "Only an incident can be restarted." }, 400);
  try {
    const attempt = await createStore().resetAttempt(viewer.id, challenge.id);
    return json({ attempt });
  } catch (error) {
    logSafe(error);
    return json({ error: "Could not start a new incident." }, 500);
  }
}
