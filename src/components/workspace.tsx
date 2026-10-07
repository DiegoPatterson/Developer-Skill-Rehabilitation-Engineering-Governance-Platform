"use client";

import { assessOption, monthlyCost } from "@/engine/cost";
import type { SpecInput } from "@/engine/spec";
import { formatLessonNumber } from "@/content/lesson";
import type { GradeResponse } from "@/content/payload";
import type { AttemptView, WorkspaceView } from "@/content/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Blocks } from "./blocks";
import { CfgViewPanel } from "./cfg-view";
import { CodeEditor } from "./code-editor";

const emptySpec = (): SpecInput => ({
  title: "",
  summary: "",
  nonGoals: "",
  endpoints: [{ method: "GET", path: "", auth: "", errors: "", request: "", response: "" }],
  entities: [{ name: "", fields: "" }],
  acceptance: "",
});

function actionLabels(kind: WorkspaceView["kind"]): { run: string; submit: string } {
  if (kind === "patch" || kind === "incident") return { run: "Run", submit: "Submit" };
  if (kind === "review" || kind === "spec" || kind === "flags") return { run: "Score", submit: "Submit" };
  return { run: "Check", submit: "Submit" };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}

function Unavailable({ view }: { view: WorkspaceView }) {
  return (
    <section className="mx-auto max-w-xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">
        {formatLessonNumber(view.number)} · {view.category}
        {view.label ? ` · ${view.label}` : ""}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-50">{view.title}</h1>
      <p className="mt-3 text-sm text-zinc-400">This lesson could not be opened.</p>
    </section>
  );
}

function Timer({ deadline }: { deadline: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!deadline) return null;
  const remaining = new Date(deadline).getTime() - now;
  const late = remaining <= 0;
  const total = Math.abs(remaining);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const label = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return <span className={late ? "text-red-300" : "text-[#4ADE80]"}>{late ? `${label} late` : label}</span>;
}

export function Workspace({ view, attempt }: { view: WorkspaceView; attempt: AttemptView | null }) {
  if (!attempt) return <Unavailable view={view} />;
  return <LiveWorkspace view={view} attempt={attempt} />;
}

function LiveWorkspace({ view, attempt }: { view: WorkspaceView; attempt: AttemptView }) {
  const router = useRouter();
  const labels = actionLabels(view.kind);
  const [files, setFiles] = useState<Record<string, string>>(() =>
    Object.fromEntries(view.files.map((file) => [file.name, file.starter])),
  );
  const [activeFile, setActiveFile] = useState(view.files[0]?.name ?? "");
  const [diff, setDiff] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<{ file: string; line: number; category: string; text: string }[]>([]);
  const [draft, setDraft] = useState({
    file: view.reviewFiles[0]?.name ?? "",
    line: 1,
    category: view.categories[0] ?? "",
    text: "",
  });
  const [spec, setSpec] = useState<SpecInput>(emptySpec);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [tools, setTools] = useState<Record<string, "" | "allow" | "ask" | "deny">>({});
  const [gates, setGates] = useState<Record<string, boolean>>({});
  const [choice, setChoice] = useState("");
  const [hints, setHints] = useState(attempt.hints);
  const [hintsUsed, setHintsUsed] = useState(attempt.hintsUsed);
  const [deadline, setDeadline] = useState(attempt.deadlineAt);
  const [result, setResult] = useState<GradeResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pane, setPane] = useState<"problem" | "work" | "results">("work");
  const [frames, setFrames] = useState<{ line: number; locals: unknown }[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [scenarioId, setScenarioId] = useState(view.scenarios[0]?.id ?? "");
  const runRef = useRef<() => void>(() => undefined);

  const issued = view.files.find((file) => file.name === (view.traceFile ?? activeFile))?.starter ?? "";
  const activeFrame = frames[frameIndex];

  function payload() {
    const selectedTools = Object.fromEntries(Object.entries(tools).filter((entry): entry is [string, "allow" | "ask" | "deny"] => entry[1] !== ""));
    return {
      nodeId: view.id,
      files,
      values,
      answers,
      comments,
      spec: view.kind === "spec" ? spec : undefined,
      flagged: view.kind === "flags" ? flagged : undefined,
      tools: view.kind === "governance" ? selectedTools : undefined,
      gates: view.kind === "governance" ? gates : undefined,
      choice: view.kind === "tradeoff" ? choice : undefined,
    };
  }

  async function grade(mode: "run" | "submit") {
    setBusy(mode);
    setError("");
    try {
      const body = await postJson<GradeResponse>("/api/grade", { ...payload(), mode });
      setResult(body);
      setPane("results");
      if (mode === "submit") router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    runRef.current = () => {
      if (!busy) void grade("run");
    };
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        runRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function revealHint() {
    setBusy("hint");
    setError("");
    try {
      const body = await postJson<{ hints: string[]; hintsUsed: number }>("/api/hint", { nodeId: view.id });
      setHints((current) => (body.hints.length >= current.length ? body.hints : current));
      setHintsUsed((current) => Math.max(current, body.hintsUsed));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  async function trace() {
    setBusy("trace");
    setError("");
    try {
      const body = await postJson<{ frames: { line: number; locals: unknown }[] }>("/api/trace", {
        nodeId: view.id,
        scenarioId,
      });
      setFrames(body.frames);
      setFrameIndex(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  async function resetIncident() {
    setBusy("reset");
    setError("");
    try {
      const body = await postJson<{ attempt: AttemptView }>("/api/attempt/reset", { nodeId: view.id });
      setDeadline(body.attempt.deadlineAt);
      setHints([]);
      setHintsUsed(0);
      setResult(null);
      setFrames([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  const costs = useMemo(() => {
    if (!view.scenario) return [];
    return view.options.map((option) => ({ option, ...assessOption(option, view.scenario!) }));
  }, [view.options, view.scenario]);

  const paneClass = (name: "problem" | "work" | "results", base: string) => `${base}${pane === name ? " is-active" : ""}`;

  return (
    <div className="workspace">
      <div className="workspace__tabs">
        {(["problem", "work", "results"] as const).map((name) => (
          <button key={name} className={`btn ${pane === name ? "btn-primary" : ""}`} type="button" onClick={() => setPane(name)}>
            {name[0].toUpperCase() + name.slice(1)}
          </button>
        ))}
        <Link href={`/challenge/${view.id}/submissions`} className="btn">
          Submissions
        </Link>
      </div>
      <section className={paneClass("problem", "workspace__problem bg-[#121215] p-4")}>
        <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
          {formatLessonNumber(view.number)} · {view.category}
          {view.label ? ` · ${view.label}` : ""} · difficulty {view.difficulty}
        </p>
        <h1 className="mt-1 text-lg font-semibold text-zinc-50">{view.title}</h1>
        <Link href={`/challenge/${view.id}/submissions`} className="mt-2 inline-block text-sm text-[#4ADE80]">
          Submissions
        </Link>
        <p className="mt-2 font-mono text-xs text-[#4ADE80]">{view.signature}</p>
        <div className="mt-4">
          <Blocks blocks={view.brief} />
        </div>
        {view.constraints.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-400">
            {view.constraints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {view.tests.length > 0 ? (
          <div className="mt-4">
            <h2 className="text-xs uppercase tracking-wide text-zinc-500">Checks</h2>
            <ul className="mt-2 space-y-1 text-sm text-zinc-300">
              {view.tests.map((test) => (
                <li key={test.name}>{test.name}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-4">
          <button className="btn" type="button" onClick={() => void revealHint()} disabled={Boolean(busy) || hintsUsed >= view.hintCount}>
            {hintsUsed >= view.hintCount ? "No hints left" : "Next hint"}
          </button>
          {view.kind === "patch" || view.kind === "incident" ? (
            <p className="mt-2 text-xs text-zinc-500">Each hint lowers the stored score by 6. Hints do not block a non-patch node.</p>
          ) : null}
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
            {hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ol>
        </div>
      </section>
      <section className={paneClass("work", "workspace__work bg-[#121215]")}>
        {view.kind === "patch" || view.kind === "incident" ? (
          <>
            <div className="flex items-center gap-2 border-b border-[#27272A] px-3 py-2">
              {view.files.map((file) => (
                <button
                  key={file.name}
                  type="button"
                  className={`btn ${activeFile === file.name ? "btn-primary" : ""}`}
                  onClick={() => setActiveFile(file.name)}
                >
                  {file.name}
                </button>
              ))}
              <button type="button" className="btn ml-auto" onClick={() => setDiff((value) => !value)}>
                {diff ? "Editor" : "Diff vs issued"}
              </button>
            </div>
            <CodeEditor
              value={files[activeFile] ?? ""}
              starter={view.files.find((file) => file.name === activeFile)?.starter ?? ""}
              diff={diff}
              onChange={(value) => setFiles((current) => ({ ...current, [activeFile]: value }))}
            />
          </>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
            {view.traceCode ? (
              <pre className="overflow-auto rounded-md border border-[#27272A] bg-[#09090B] p-3 font-mono text-xs">{view.traceCode}</pre>
            ) : null}
            {view.cfg ? <CfgViewPanel cfg={view.cfg} /> : null}
            {view.kind === "trace"
              ? view.checkpoints.map((checkpoint) => (
                  <label key={checkpoint.id} className="flex flex-col gap-1 text-sm text-zinc-400">
                    {checkpoint.prompt}
                    <input
                      className="field font-mono"
                      value={values[checkpoint.id] ?? ""}
                      onChange={(event) => setValues((current) => ({ ...current, [checkpoint.id]: event.target.value }))}
                    />
                  </label>
                ))
              : null}
            {view.kind === "choice"
              ? view.questions.map((question) => (
                  <fieldset key={question.id} className="space-y-2">
                    <legend className="text-sm text-zinc-200">{question.prompt}</legend>
                    {question.code ? (
                      <pre className="overflow-auto rounded-md border border-[#27272A] bg-[#09090B] p-3 font-mono text-xs">{question.code}</pre>
                    ) : null}
                    {question.options.map((option) => (
                      <label key={option.id} className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="radio"
                          name={question.id}
                          checked={answers[question.id] === option.id}
                          onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                        />
                        {option.label}
                      </label>
                    ))}
                  </fieldset>
                ))
              : null}
            {view.kind === "review" ? (
              <>
                {view.reviewFiles.map((file) => (
                  <div key={file.name}>
                    <h2 className="font-mono text-xs text-zinc-500">{file.name}</h2>
                    <pre className="mt-2 overflow-auto rounded-md border border-[#27272A] bg-[#09090B] p-3 font-mono text-xs leading-5">
                      {file.content.split("\n").map((line, index) => (
                        <div key={`${file.name}-${index}`}>
                          <span className="mr-3 inline-block w-6 text-right text-zinc-600">{index + 1}</span>
                          {line}
                        </div>
                      ))}
                    </pre>
                  </div>
                ))}
                <div className="grid gap-2 sm:grid-cols-3">
                  <select className="field" value={draft.file} onChange={(event) => setDraft({ ...draft, file: event.target.value })}>
                    {view.reviewFiles.map((file) => (
                      <option key={file.name}>{file.name}</option>
                    ))}
                  </select>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    value={draft.line}
                    onChange={(event) => setDraft({ ...draft, line: Number(event.target.value) })}
                  />
                  <select className="field" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                    {view.categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <textarea className="field min-h-20" value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} placeholder="What is wrong, in one comment" />
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    if (draft.text.trim().length < 8) return;
                    setComments((current) => [...current, { ...draft, line: Number(draft.line) }]);
                    setDraft({ ...draft, text: "" });
                  }}
                >
                  Add comment
                </button>
                <ul className="space-y-2 text-sm text-zinc-300">
                  {comments.map((comment, index) => (
                    <li key={`${comment.file}-${index}`} className="flex items-start justify-between gap-3">
                      <span>
                        {comment.file}:{comment.line} · {comment.category} · {comment.text}
                      </span>
                      <button className="btn" type="button" onClick={() => setComments(comments.filter((_, item) => item !== index))}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {view.kind === "spec" ? <SpecForm spec={spec} onChange={setSpec} /> : null}
            {view.kind === "flags"
              ? view.pipeline.map((step) => (
                  <label key={step.id} className="flex items-start gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={flagged.includes(step.id)}
                      onChange={(event) =>
                        setFlagged((current) => (event.target.checked ? [...current, step.id] : current.filter((id) => id !== step.id)))
                      }
                    />
                    <span>{step.text}</span>
                  </label>
                ))
              : null}
            {view.kind === "governance" ? (
              <div className="space-y-3">
                {view.tools.map((tool) => (
                  <label key={tool.id} className="grid grid-cols-[1fr_140px] items-center gap-3 text-sm">
                    <span>
                      <span className="font-mono text-zinc-200">{tool.id}</span>
                      <span className="mt-1 block text-zinc-500">{tool.description}</span>
                    </span>
                    <select
                      className="field"
                      value={tools[tool.id] ?? ""}
                      onChange={(event) => setTools((current) => ({ ...current, [tool.id]: event.target.value as "" | "allow" | "ask" | "deny" }))}
                    >
                      <option value="">Choose</option>
                      <option value="allow">allow</option>
                      <option value="ask">ask</option>
                      <option value="deny">deny</option>
                    </select>
                  </label>
                ))}
                {view.gates.map((gate) => (
                  <label key={gate.id} className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={Boolean(gates[gate.id])}
                      onChange={(event) => setGates((current) => ({ ...current, [gate.id]: event.target.checked }))}
                    />
                    <span>
                      {gate.id} — {gate.description}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
            {view.kind === "tradeoff" && view.scenario ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">
                  {view.scenario.requestsPerDay.toLocaleString()} requests/day · {view.scenario.inputTokens} in / {view.scenario.outputTokens} out · p95 ≤ {view.scenario.latencyBudgetMs} ms · budget ${view.scenario.monthlyBudget.toLocaleString()} · accuracy ≥ {view.scenario.accuracyBar}
                </p>
                {costs.map(({ option, cost, latencyOk, budgetOk, accuracyOk }) => (
                  <label key={option.id} className="block rounded-md border border-[#27272A] bg-[#09090B] p-3 text-sm">
                    <span className="flex items-center gap-2">
                      <input type="radio" name="choice" checked={choice === option.id} onChange={() => setChoice(option.id)} />
                      <span className="font-medium text-zinc-100">{option.title}</span>
                    </span>
                    <span className="mt-2 block text-zinc-400">{option.note}</span>
                    <span className="mt-2 block font-mono text-xs text-zinc-300">
                      ${monthlyCost(option, view.scenario!).toFixed(0)} / month · {option.latencyMs} ms · {(option.accuracy * 100).toFixed(1)}%
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      Latency {latencyOk ? "ok" : "over"} · budget {budgetOk ? "ok" : "over"} · accuracy {accuracyOk ? "ok" : "under"} · computed ${cost.toFixed(0)}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>
      <section className={paneClass("results", "workspace__results bg-[#121215] p-4")}>
        {view.scenarios.length > 0 ? (
          <div className="mb-4 space-y-3 border-b border-[#27272A] pb-4">
            <h2 className="text-xs uppercase tracking-wide text-zinc-500">Issued trace</h2>
            <p className="text-xs text-zinc-500">Stepping the issued snippet. These frames are not your edit and they are not the answer key.</p>
            <div className="flex gap-2">
              <select className="field" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
                {view.scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.label}
                  </option>
                ))}
              </select>
              <button className="btn" type="button" onClick={() => void trace()} disabled={Boolean(busy)}>
                Step
              </button>
            </div>
            {frames.length > 0 && activeFrame ? (
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                  <button className="btn" type="button" onClick={() => setFrameIndex((index) => Math.max(0, index - 1))}>
                    Prev
                  </button>
                  <span>
                    Frame {frameIndex + 1} / {frames.length} · line {activeFrame.line}
                  </span>
                  <button className="btn" type="button" onClick={() => setFrameIndex((index) => Math.min(frames.length - 1, index + 1))}>
                    Next
                  </button>
                </div>
                <pre className="overflow-auto rounded-md border border-[#27272A] bg-[#09090B] p-3 font-mono text-xs leading-5">
                  {issued.split("\n").map((line, index) => (
                    <div key={index} className={index + 1 === activeFrame.line ? "bg-[#052e16]" : ""}>
                      {line || " "}
                    </div>
                  ))}
                </pre>
                <pre className="mt-2 overflow-auto font-mono text-xs text-zinc-400">{JSON.stringify(activeFrame.locals, null, 2)}</pre>
              </div>
            ) : null}
          </div>
        ) : null}
        <h2 className="text-xs uppercase tracking-wide text-zinc-500">Results</h2>
        {!result ? <p className="mt-3 text-sm text-zinc-500">Run checks the work. Submit records the score.</p> : <Results result={result} />}
      </section>
      <footer className="workspace__footer flex flex-wrap items-center gap-3 bg-[#09090B] px-4 py-3">
        <Timer deadline={deadline} />
        {view.kind === "incident" ? (
          <button className="btn" type="button" onClick={() => void resetIncident()} disabled={Boolean(busy)}>
            Start a new incident
          </button>
        ) : null}
        <p className="min-w-0 flex-1 truncate text-sm text-red-300">{error}</p>
        <span className="hidden text-xs text-zinc-600 sm:inline">Ctrl/Cmd+Enter runs</span>
        <button className="btn" type="button" onClick={() => void grade("run")} disabled={Boolean(busy)}>
          {busy === "run" ? "Running…" : labels.run}
        </button>
        <button className="btn btn-primary" type="button" onClick={() => void grade("submit")} disabled={Boolean(busy)}>
          {busy === "submit" ? "Submitting…" : labels.submit}
        </button>
      </footer>
    </div>
  );
}

function Results({ result }: { result: GradeResponse }) {
  const { evaluation } = result;
  return (
    <div className="mt-3 space-y-3 text-sm">
      <p className="font-mono text-2xl text-zinc-50">{result.mode === "submit" ? result.storedScore : evaluation.score}</p>
      {result.mode === "run" ? <p className="text-xs text-zinc-500">Run does not change ELO, streak, or mastery.</p> : null}
      {result.mode === "submit" && result.storedScore !== evaluation.score ? (
        <p className="text-xs text-zinc-500">Raw score {evaluation.score}. Stored score includes hints{result.late ? " and the late cap" : ""}.</p>
      ) : null}
      {result.mastered ? <p className="text-[#4ADE80]">Mastered. Overall ELO {result.overallElo}. Streak {result.streak}. Shields {result.shields}.</p> : null}
      {result.mode === "submit" && result.mastered === false ? (
        <p className="text-zinc-400">{result.late ? "Late submit recorded. It cannot master this node." : "Recorded. The node is not mastered yet."}</p>
      ) : null}
      <dl className="grid grid-cols-3 gap-2 font-mono text-xs text-zinc-400">
        <div>Correct {evaluation.correctness.toFixed(2)}</div>
        <div>Perf {evaluation.performance.toFixed(2)}</div>
        <div>Maint {evaluation.maintainability.toFixed(2)}</div>
      </dl>
      <ul className="space-y-1">
        {evaluation.tests.map((test) => (
          <li key={test.name} className={test.passed ? "text-[#4ADE80]" : "text-zinc-300"}>
            {test.passed ? "Pass" : "Fail"} · {test.name}
            {test.message ? <span className="text-zinc-500"> — {test.message}</span> : null}
          </li>
        ))}
      </ul>
      {evaluation.missed && evaluation.missed.length > 0 ? (
        <ul className="list-disc pl-5 text-zinc-400">
          {evaluation.missed.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {evaluation.explanations ? (
        <ul className="space-y-2 text-zinc-400">
          {evaluation.explanations.map((item) => (
            <li key={item.id}>{item.explanation}</li>
          ))}
        </ul>
      ) : null}
      {evaluation.debrief ? <Blocks blocks={evaluation.debrief} /> : null}
    </div>
  );
}

function SpecForm({ spec, onChange }: { spec: SpecInput; onChange: (spec: SpecInput) => void }) {
  function patch(partial: Partial<SpecInput>) {
    onChange({ ...spec, ...partial });
  }
  return (
    <div className="space-y-3">
      <label className="block text-sm text-zinc-400">
        Title
        <input className="field mt-1" value={spec.title} onChange={(event) => patch({ title: event.target.value })} />
      </label>
      <label className="block text-sm text-zinc-400">
        Summary
        <textarea className="field mt-1 min-h-24" value={spec.summary} onChange={(event) => patch({ summary: event.target.value })} />
      </label>
      <label className="block text-sm text-zinc-400">
        Non-goals
        <textarea className="field mt-1 min-h-16" value={spec.nonGoals} onChange={(event) => patch({ nonGoals: event.target.value })} />
      </label>
      {spec.endpoints.map((endpoint, index) => (
        <div key={index} className="grid gap-2 rounded-md border border-[#27272A] p-3">
          <input className="field" value={endpoint.method} onChange={(event) => updateEndpoint(index, { method: event.target.value })} placeholder="Method" />
          <input className="field" value={endpoint.path} onChange={(event) => updateEndpoint(index, { path: event.target.value })} placeholder="Path" />
          <input className="field" value={endpoint.auth} onChange={(event) => updateEndpoint(index, { auth: event.target.value })} placeholder="Auth" />
          <input className="field" value={endpoint.errors} onChange={(event) => updateEndpoint(index, { errors: event.target.value })} placeholder="Errors" />
          <input className="field" value={endpoint.request} onChange={(event) => updateEndpoint(index, { request: event.target.value })} placeholder="Request" />
          <input className="field" value={endpoint.response} onChange={(event) => updateEndpoint(index, { response: event.target.value })} placeholder="Response" />
        </div>
      ))}
      <button
        className="btn"
        type="button"
        onClick={() => patch({ endpoints: [...spec.endpoints, { method: "GET", path: "", auth: "", errors: "", request: "", response: "" }] })}
      >
        Add endpoint
      </button>
      {spec.entities.map((entity, index) => (
        <div key={index} className="grid gap-2">
          <input
            className="field"
            value={entity.name}
            placeholder="Entity"
            onChange={(event) => {
              const entities = spec.entities.slice();
              entities[index] = { ...entity, name: event.target.value };
              patch({ entities });
            }}
          />
          <input
            className="field"
            value={entity.fields}
            placeholder="Fields"
            onChange={(event) => {
              const entities = spec.entities.slice();
              entities[index] = { ...entity, fields: event.target.value };
              patch({ entities });
            }}
          />
        </div>
      ))}
      <button className="btn" type="button" onClick={() => patch({ entities: [...spec.entities, { name: "", fields: "" }] })}>
        Add entity
      </button>
      <label className="block text-sm text-zinc-400">
        Acceptance
        <textarea className="field mt-1 min-h-20" value={spec.acceptance} onChange={(event) => patch({ acceptance: event.target.value })} />
      </label>
    </div>
  );

  function updateEndpoint(index: number, partial: Partial<SpecInput["endpoints"][number]>) {
    const endpoints = spec.endpoints.slice();
    endpoints[index] = { ...endpoints[index], ...partial };
    patch({ endpoints });
  }
}
