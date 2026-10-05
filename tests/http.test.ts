import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getChallenge } from "@/content/catalog";

const base = process.env.HTTP_CHECK ?? "";
const run = base ? describe : describe.skip;

function filesOf(id: string, which: "starter" | "solution"): Record<string, string> {
  const challenge = getChallenge(id);
  if (!challenge?.files) throw new Error(`Missing files for ${id}`);
  return Object.fromEntries(challenge.files.map((file) => [file.name, file[which]]));
}

run("http", () => {
  it("registers, locks a later node, fails the starter, and masters the reference", async () => {
    const username = `sg${Date.now().toString(36)}`;
    const password = "practice-pass-10";
    const registered = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, email: `${username}@example.com`, password, confirmPassword: password }),
    });
    expect(registered.status, await registered.clone().text()).toBe(200);
    const registeredBody = (await registered.json()) as { verificationRequired?: boolean };
    expect(registeredBody.verificationRequired).toBe(true);
    expect(registered.headers.getSetCookie().join("")).not.toContain("sg_session=");

    const tooEarly = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    expect(tooEarly.status).toBe(403);

    const mail = JSON.parse(readFileSync("tmp/last-mail.json", "utf8")) as { to: string; text: string };
    expect(mail.to).toBe(`${username}@example.com`);
    expect(mail.text).toContain("strayapps.co@gmail.com");
    const token = mail.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();
    const verified = await fetch(`${base}/verify?token=${token}`, { redirect: "manual" });
    expect(verified.status).toBe(307);
    expect(verified.headers.get("location")).toContain("/login");

    const logged = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    expect(logged.status, await logged.clone().text()).toBe(200);
    const cookie = logged.headers.getSetCookie().map((item) => item.split(";")[0]).join("; ");
    expect(cookie).toContain("sg_session=");

    const lockedPage = await fetch(`${base}/challenge/dbg-boundaries`, { headers: { cookie } });
    expect(lockedPage.status).toBe(200);
    const lockedHtml = await lockedPage.text();
    expect(lockedHtml).toContain("stays locked");
    expect(lockedHtml).not.toContain("REFERENCE_SOLUTION");

    const lockedGrade = await fetch(`${base}/api/grade`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ nodeId: "dbg-boundaries", mode: "run", files: filesOf("dbg-boundaries", "solution") }),
    });
    expect(lockedGrade.status).toBe(403);

    const openPage = await fetch(`${base}/challenge/dbg-state-basics`, { headers: { cookie } });
    expect(openPage.status).toBe(200);
    const openHtml = await openPage.text();
    expect(openHtml).toContain("Alias and ledger transfers");
    expect(openHtml).not.toContain("REFERENCE_SOLUTION");

    const ran = await fetch(`${base}/api/grade`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ nodeId: "dbg-state-basics", mode: "run", files: filesOf("dbg-state-basics", "starter") }),
    });
    expect(ran.status, await ran.clone().text()).toBe(200);
    const ranBody = (await ran.json()) as { evaluation: { passedAll: boolean; debrief: unknown }; mastered: null };
    expect(ranBody.evaluation.passedAll).toBe(false);
    expect(ranBody.evaluation.debrief).toBeNull();
    expect(ranBody.mastered).toBeNull();

    const submitted = await fetch(`${base}/api/grade`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ nodeId: "dbg-state-basics", mode: "submit", files: filesOf("dbg-state-basics", "solution") }),
    });
    expect(submitted.status, await submitted.clone().text()).toBe(200);
    const submittedBody = (await submitted.json()) as {
      evaluation: { passedAll: boolean; debrief: unknown[] | null };
      mastered: boolean;
      storedScore: number;
      overallElo: number;
      streak: number;
    };
    expect(submittedBody.evaluation.passedAll).toBe(true);
    expect(submittedBody.mastered).toBe(true);
    expect(submittedBody.storedScore).toBeGreaterThanOrEqual(70);
    expect(submittedBody.overallElo).toBeGreaterThan(1200);
    expect(submittedBody.streak).toBe(1);
    expect(submittedBody.evaluation.debrief?.length).toBeGreaterThan(0);

    const trace = getChallenge("comp-trace");
    const values = Object.fromEntries((trace?.checkpoints ?? []).map((checkpoint) => [checkpoint.id, checkpoint.answer]));
    const traced = await fetch(`${base}/api/grade`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ nodeId: "comp-trace", mode: "submit", values }),
    });
    expect(traced.status, await traced.clone().text()).toBe(200);
    const tracedBody = (await traced.json()) as { mastered: boolean };
    expect(tracedBody.mastered).toBe(true);

    const hinted = await fetch(`${base}/api/hint`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ nodeId: "dbg-boundaries" }),
    });
    expect(hinted.status).toBe(200);
    const hintBody = (await hinted.json()) as { hints: string[]; hintsUsed: number };
    expect(hintBody.hintsUsed).toBe(1);
    expect(hintBody.hints).toHaveLength(1);

    const stepped = await fetch(`${base}/api/trace`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ nodeId: "dbg-state-basics", scenarioId: "pay-b" }),
    });
    expect(stepped.status, await stepped.clone().text()).toBe(200);
    const stepBody = (await stepped.json()) as { frames: { line: number }[] };
    expect(stepBody.frames.length).toBeGreaterThan(0);
    expect(JSON.stringify(stepBody)).not.toContain("REFERENCE_SOLUTION");

    const dashboard = await fetch(`${base}/dashboard`, { headers: { cookie } });
    expect(dashboard.status).toBe(200);
    const dashboardHtml = await dashboard.text();
    expect(dashboardHtml).toContain("Alias and ledger transfers");
    expect(dashboardHtml).toContain("Median time to fix");

    const outage = await fetch(`${base}/outage`, { headers: { cookie } });
    expect(outage.status).toBe(200);
    expect(await outage.text()).toContain("Payments ledger incident");

    const graph = await fetch(`${base}/graph`, { headers: { cookie } });
    expect(graph.status).toBe(200);
    expect(await graph.text()).toContain("Alias and ledger transfers");

    const anonymous = await fetch(`${base}/api/grade`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nodeId: "dbg-state-basics", mode: "run" }),
    });
    expect(anonymous.status).toBe(401);

    const loggedOut = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { cookie } });
    expect(loggedOut.status).toBe(200);
    const after = await fetch(`${base}/graph`, { redirect: "manual" });
    expect(after.status).toBe(307);
    expect(after.headers.get("location")).toContain("/login");
  }, 60000);
});
