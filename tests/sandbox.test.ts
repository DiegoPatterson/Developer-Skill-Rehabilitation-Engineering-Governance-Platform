import { describe, expect, it } from "vitest";
import { LocalPermissionSandbox } from "@/sandbox/run";

describe("local sandbox", () => {
  it("does not expose secrets or the filesystem when code escapes the vm", async () => {
    const sandbox = new LocalPermissionSandbox();
    const output = await sandbox.run({
      files: {
        "probe.js": `function probe() {
  let escaped = "no";
  let fsRead = "blocked";
  let net = "blocked";
  let env = "hidden";
  try {
    const proc = ({}).constructor.constructor("return process")();
    escaped = "yes";
    if (proc.env.DATABASE_URL || proc.env.PGPASSWORD || proc.env.SESSION_SECRET) env = "leaked";
    else env = "clean";
    try {
      proc.mainModule.require("fs").readFileSync("C:/Windows/win.ini", "utf8");
      fsRead = "open";
    } catch (error) {
      fsRead = "blocked";
    }
    try {
      proc.mainModule.require("http").get("http://127.0.0.1:9");
      net = "open";
    } catch (error) {
      net = "blocked";
    }
  } catch (error) {
    escaped = "no";
  }
  return { fsRead, net, leaked: env === "leaked" };
}`,
      },
      order: ["probe.js"],
      steps: [{ type: "call", name: "probe", entry: "probe", args: [], expect: { fsRead: "blocked", net: "blocked", leaked: false } }],
    });
    expect(output.ok, output.error).toBe(true);
    expect(output.meta?.secretEnv ?? []).toEqual([]);
    expect(output.results[0]?.passed, output.results[0]?.message).toBe(true);
  });
});
