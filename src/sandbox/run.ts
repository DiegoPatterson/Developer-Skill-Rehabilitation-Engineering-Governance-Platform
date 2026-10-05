import { spawn } from "node:child_process";
import path from "node:path";

export type SandboxStep = Record<string, unknown> & { type: string; name: string };

export type SandboxJob = {
  files: Record<string, string>;
  order: string[];
  steps: SandboxStep[];
  loadTimeoutMs?: number;
};

export type SandboxStepResult = {
  name: string;
  passed: boolean;
  message: string;
  ms: number;
  data: unknown;
};

export type SandboxOutput = {
  ok: boolean;
  error?: string;
  results: SandboxStepResult[];
  meta?: { secretEnv: string[] };
};

export interface CodeSandbox {
  run(job: SandboxJob, wallMs?: number): Promise<SandboxOutput>;
}

function childPath(): string {
  return path.join(process.cwd(), "sandbox", "child.js");
}

export class LocalPermissionSandbox implements CodeSandbox {
  run(job: SandboxJob, wallMs = 8000): Promise<SandboxOutput> {
    const script = childPath();
    return new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        ["--permission", `--allow-fs-read=${script}`, "--max-old-space-size=192", script],
        {
          env: {
            PATH: process.env.PATH ?? "",
            SystemRoot: process.env.SystemRoot ?? "C:\\Windows",
            PATHEXT: process.env.PATHEXT ?? ".EXE;.CMD",
            TEMP: process.env.TEMP ?? "",
            TMP: process.env.TMP ?? "",
          } as unknown as NodeJS.ProcessEnv,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        },
      );

      let stdout = "";
      let stderr = "";
      let settled = false;
      const finish = (output: SandboxOutput) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(output);
      };
      const timer = setTimeout(() => {
        child.kill();
        finish({
          ok: false,
          error: "Timed out. The submission is too slow or blocked the event loop.",
          results: [],
        });
      }, wallMs);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", (error) => finish({ ok: false, error: error.message, results: [] }));
      child.on("close", () => {
        if (settled) return;
        try {
          finish(JSON.parse(stdout) as SandboxOutput);
        } catch {
          finish({
            ok: false,
            error: (stderr || stdout || "Sandbox produced no result.").slice(0, 800),
            results: [],
          });
        }
      });

      const payload = JSON.stringify(job);
      if (payload.length > 1_200_000) {
        child.kill();
        finish({ ok: false, error: "Submission is too large.", results: [] });
        return;
      }
      child.stdin.write(payload);
      child.stdin.end();
    });
  }
}

export class E2BSandbox implements CodeSandbox {
  async run(): Promise<SandboxOutput> {
    throw new Error("E2B sandbox is not configured. The local permission sandbox is the current driver. See docs/architecture.md.");
  }
}

export function createSandbox(): CodeSandbox {
  if (process.env.SANDBOX_DRIVER === "e2b") return new E2BSandbox();
  return new LocalPermissionSandbox();
}

let sandbox: CodeSandbox | null = null;

export function getSandbox(): CodeSandbox {
  sandbox ??= createSandbox();
  return sandbox;
}
