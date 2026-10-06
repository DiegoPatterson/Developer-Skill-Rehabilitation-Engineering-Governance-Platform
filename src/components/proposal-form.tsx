"use client";

import { LESSON_TYPES } from "@/content/lesson";
import { PROPOSAL_KINDS, type ProposalDraft, type ProposalKind } from "@/content/proposal";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

type Patch = NonNullable<ProposalDraft["patch"]>;
type Choice = NonNullable<ProposalDraft["choice"]>;
type Trace = NonNullable<ProposalDraft["trace"]>;
type Flags = NonNullable<ProposalDraft["flags"]>;
type Governance = NonNullable<ProposalDraft["governance"]>;
type Review = NonNullable<ProposalDraft["review"]>;
type Tradeoff = NonNullable<ProposalDraft["tradeoff"]>;

type FormState = {
  label: string;
  title: string;
  description: string;
  category: ProposalDraft["category"];
  kind: ProposalKind;
  difficulty: number;
  showInGraph: boolean;
  prereqText: string;
  signature: string;
  constraintsText: string;
  hintsText: string;
  debrief: string;
  patch: Patch;
  choice: Choice;
  trace: Trace;
  flags: Flags;
  governance: Governance;
  review: Review;
  tradeoff: Tradeoff;
};

const KIND_HELP: Record<ProposalKind, string> = {
  patch: "Players repair the starter. Each hidden test calls a top-level function, or expects it to throw.",
  choice: "Players pick one option per question.",
  trace: "Players type the exact checkpoint answer.",
  review: "Players comment on the file. Each finding's anchor must sit on one line, and a matching comment can be within 3 lines.",
  flags: "Players flag the steps that leak information.",
  governance: "Players set each tool to allow, ask, or deny, and each gate on or off.",
  tradeoff: "Players pick the only option that meets the latency, budget, and accuracy bars.",
};

function blank(): FormState {
  return {
    label: "",
    title: "",
    description: "",
    category: "debugging",
    kind: "patch",
    difficulty: 1,
    showInGraph: true,
    prereqText: "",
    signature: "",
    constraintsText: "",
    hintsText: "",
    debrief: "",
    patch: {
      fileName: "solution.js",
      starter: "",
      solution: "",
      tests: [{ name: "", entry: "", argsText: "[]", mode: "returns", expectText: "", messageIncludes: "" }],
    },
    choice: { questions: [{ prompt: "", code: "", options: ["", ""], answer: 0, explanation: "" }] },
    trace: { code: "", checkpoints: [{ prompt: "", answer: "" }] },
    flags: {
      steps: [
        { text: "", leak: false },
        { text: "", leak: true },
      ],
    },
    governance: {
      tools: [{ description: "", answer: "ask" }],
      gates: [{ description: "", answer: true }],
    },
    review: {
      files: [{ name: "change.js", content: "" }],
      findings: [{ file: "change.js", anchor: "", category: "", summary: "" }],
    },
    tradeoff: {
      requestsPerDay: 1000,
      inputTokens: 800,
      outputTokens: 120,
      latencyBudgetMs: 400,
      monthlyBudget: 100,
      accuracyBar: 0.9,
      correct: 0,
      options: [
        {
          title: "",
          kind: "heuristic",
          inputPricePerMillion: 0,
          outputPricePerMillion: 0,
          instances: 0,
          hourly: 0,
          latencyMs: 20,
          accuracy: 0.95,
          note: "",
        },
        {
          title: "",
          kind: "api",
          inputPricePerMillion: 5,
          outputPricePerMillion: 15,
          instances: 0,
          hourly: 0,
          latencyMs: 800,
          accuracy: 0.99,
          note: "",
        },
      ],
    },
  };
}

function fromDraft(initial?: ProposalDraft): FormState {
  const next = blank();
  if (!initial) return next;
  return {
    ...next,
    ...initial,
    prereqText: initial.prereqNumbers.map((number) => `#${number}`).join(", "),
    constraintsText: initial.constraints.join("\n"),
    hintsText: initial.hints.join("\n"),
    patch: initial.patch ?? next.patch,
    choice: initial.choice ?? next.choice,
    trace: initial.trace ?? next.trace,
    flags: initial.flags ?? next.flags,
    governance: initial.governance ?? next.governance,
    review: initial.review ?? next.review,
    tradeoff: initial.tradeoff ?? next.tradeoff,
  };
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function prereqNumbers(text: string): number[] | null {
  if (!text.trim()) return [];
  const numbers = text
    .split(",")
    .map((part) => part.trim().replace(/^#/, ""))
    .filter(Boolean)
    .map(Number);
  if (numbers.some((number) => !Number.isInteger(number) || number < 1)) return null;
  return numbers;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-300">
      {label}
      {children}
    </label>
  );
}

export function ProposalForm({ initial, proposalId }: { initial?: ProposalDraft; proposalId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => fromDraft(initial));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const numbers = prereqNumbers(form.prereqText);
    if (!numbers) {
      setError("Prerequisites are lesson numbers, separated by commas.");
      return;
    }
    setPending(true);
    setError("");
    const body = {
      label: form.label,
      title: form.title,
      description: form.description,
      category: form.category,
      kind: form.kind,
      difficulty: form.difficulty,
      showInGraph: form.showInGraph,
      prereqNumbers: numbers,
      signature: form.signature,
      constraints: lines(form.constraintsText),
      hints: lines(form.hintsText),
      debrief: form.debrief,
      [form.kind]: form[form.kind],
    };
    try {
      const response = await fetch(proposalId ? `/api/proposals/${proposalId}` : "/api/proposals", {
        method: proposalId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not save the problem.");
        setPending(false);
        return;
      }
      router.push("/propose");
      router.refresh();
    } catch {
      setError("Could not save the problem.");
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <Field label="Label">
        <input className="field" value={form.label} maxLength={40} onChange={(event) => set({ label: event.target.value })} />
      </Field>
      <Field label="Name">
        <input className="field" value={form.title} maxLength={120} onChange={(event) => set({ title: event.target.value })} />
      </Field>
      <Field label="Description">
        <textarea className="field min-h-28" value={form.description} maxLength={4000} onChange={(event) => set({ description: event.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Track">
          <select className="field field-block" value={form.category} onChange={(event) => set({ category: event.target.value as FormState["category"] })}>
            {LESSON_TYPES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Question type">
          <select className="field field-block" value={form.kind} onChange={(event) => set({ kind: event.target.value as ProposalKind })}>
            {PROPOSAL_KINDS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-xs text-zinc-500">{KIND_HELP[form.kind]}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Difficulty">
          <select className="field field-block" value={form.difficulty} onChange={(event) => set({ difficulty: Number(event.target.value) })}>
            {[1, 2, 3, 4, 5].map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prerequisites">
          <input
            className="field"
            value={form.prereqText}
            placeholder="#1, #4"
            onChange={(event) => set({ prereqText: event.target.value })}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={form.showInGraph} onChange={(event) => set({ showInGraph: event.target.checked })} />
        Show this lesson on its skill tree
      </label>
      <Field label="Signature">
        <input className="field font-mono text-sm" value={form.signature} maxLength={200} onChange={(event) => set({ signature: event.target.value })} />
      </Field>
      <Field label="Rules, one per line">
        <textarea className="field min-h-20" value={form.constraintsText} onChange={(event) => set({ constraintsText: event.target.value })} />
      </Field>
      <Field label="Hints, one per line">
        <textarea className="field min-h-20" value={form.hintsText} onChange={(event) => set({ hintsText: event.target.value })} />
      </Field>
      <Field label="Debrief">
        <textarea className="field min-h-20" value={form.debrief} maxLength={2000} onChange={(event) => set({ debrief: event.target.value })} />
      </Field>
      {form.kind === "patch" ? <PatchFields patch={form.patch} onChange={(patch) => set({ patch })} /> : null}
      {form.kind === "choice" ? <ChoiceFields choice={form.choice} onChange={(choice) => set({ choice })} /> : null}
      {form.kind === "trace" ? <TraceFields trace={form.trace} onChange={(trace) => set({ trace })} /> : null}
      {form.kind === "flags" ? <FlagFields flags={form.flags} onChange={(flags) => set({ flags })} /> : null}
      {form.kind === "governance" ? <GovernanceFields governance={form.governance} onChange={(governance) => set({ governance })} /> : null}
      {form.kind === "review" ? <ReviewFields review={form.review} onChange={(review) => set({ review })} /> : null}
      {form.kind === "tradeoff" ? <TradeoffFields tradeoff={form.tradeoff} onChange={(tradeoff) => set({ tradeoff })} /> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button className="btn btn-primary w-fit" type="submit" disabled={pending}>
        {pending ? "Saving…" : proposalId ? "Save and send back for review" : "Submit for review"}
      </button>
    </form>
  );
}

function PatchFields({ patch, onChange }: { patch: Patch; onChange: (patch: Patch) => void }) {
  const tests = patch.tests;
  const setTest = (index: number, next: Partial<Patch["tests"][number]>) => {
    onChange({ ...patch, tests: tests.map((test, i) => (i === index ? { ...test, ...next } : test)) });
  };
  return (
    <div className="flex flex-col gap-3">
      <Field label="File name">
        <input className="field font-mono text-sm" value={patch.fileName} onChange={(event) => onChange({ ...patch, fileName: event.target.value })} />
      </Field>
      <Field label="Starter code">
        <textarea className="field min-h-40 font-mono text-xs" value={patch.starter} onChange={(event) => onChange({ ...patch, starter: event.target.value })} />
      </Field>
      <Field label="Reference solution">
        <textarea className="field min-h-40 font-mono text-xs" value={patch.solution} onChange={(event) => onChange({ ...patch, solution: event.target.value })} />
      </Field>
      {tests.map((test, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-lg border border-[#27272A] p-3">
          <div className="text-xs text-zinc-500">Test {index + 1}</div>
          <input className="field" placeholder="Name" value={test.name} onChange={(event) => setTest(index, { name: event.target.value })} />
          <input className="field font-mono text-sm" placeholder="Function name" value={test.entry} onChange={(event) => setTest(index, { entry: event.target.value })} />
          <textarea className="field min-h-16 font-mono text-xs" placeholder="Args JSON array" value={test.argsText} onChange={(event) => setTest(index, { argsText: event.target.value })} />
          <select className="field field-block" value={test.mode} onChange={(event) => setTest(index, { mode: event.target.value as "returns" | "throws" })}>
            <option value="returns">Returns JSON</option>
            <option value="throws">Throws</option>
          </select>
          {test.mode === "returns" ? (
            <textarea className="field min-h-16 font-mono text-xs" placeholder="Expected JSON" value={test.expectText} onChange={(event) => setTest(index, { expectText: event.target.value })} />
          ) : (
            <input className="field" placeholder="Error text to include" value={test.messageIncludes} onChange={(event) => setTest(index, { messageIncludes: event.target.value })} />
          )}
          {tests.length > 1 ? (
            <button className="btn w-fit" type="button" onClick={() => onChange({ ...patch, tests: tests.filter((_, i) => i !== index) })}>
              Remove test
            </button>
          ) : null}
        </div>
      ))}
      {tests.length < 12 ? (
        <button
          className="btn w-fit"
          type="button"
          onClick={() => onChange({ ...patch, tests: [...tests, { name: "", entry: "", argsText: "[]", mode: "returns", expectText: "", messageIncludes: "" }] })}
        >
          Add test
        </button>
      ) : null}
    </div>
  );
}

function ChoiceFields({ choice, onChange }: { choice: Choice; onChange: (choice: Choice) => void }) {
  const questions = choice.questions;
  const setQuestion = (index: number, next: Partial<Choice["questions"][number]>) => {
    onChange({ questions: questions.map((question, i) => (i === index ? { ...question, ...next } : question)) });
  };
  return (
    <div className="flex flex-col gap-3">
      {questions.map((question, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-lg border border-[#27272A] p-3">
          <div className="text-xs text-zinc-500">Question {index + 1}</div>
          <textarea className="field min-h-16" placeholder="Prompt" value={question.prompt} onChange={(event) => setQuestion(index, { prompt: event.target.value })} />
          <textarea className="field min-h-16 font-mono text-xs" placeholder="Code, optional" value={question.code} onChange={(event) => setQuestion(index, { code: event.target.value })} />
          {question.options.map((option, optionIndex) => (
            <input
              key={optionIndex}
              className="field"
              placeholder={`Option ${optionIndex + 1}`}
              value={option}
              onChange={(event) =>
                setQuestion(index, { options: question.options.map((item, i) => (i === optionIndex ? event.target.value : item)) })
              }
            />
          ))}
          <div className="flex flex-wrap gap-2">
            {question.options.length < 6 ? (
              <button className="btn" type="button" onClick={() => setQuestion(index, { options: [...question.options, ""] })}>
                Add option
              </button>
            ) : null}
            {question.options.length > 2 ? (
              <button className="btn" type="button" onClick={() => setQuestion(index, { options: question.options.slice(0, -1), answer: Math.min(question.answer, question.options.length - 2) })}>
                Remove option
              </button>
            ) : null}
          </div>
          <Field label="Correct option">
            <select className="field field-block" value={question.answer} onChange={(event) => setQuestion(index, { answer: Number(event.target.value) })}>
              {question.options.map((option, optionIndex) => (
                <option key={optionIndex} value={optionIndex}>
                  {optionIndex + 1}. {option || "Untitled"}
                </option>
              ))}
            </select>
          </Field>
          <textarea className="field min-h-16" placeholder="Explanation" value={question.explanation} onChange={(event) => setQuestion(index, { explanation: event.target.value })} />
          {questions.length > 1 ? (
            <button className="btn w-fit" type="button" onClick={() => onChange({ questions: questions.filter((_, i) => i !== index) })}>
              Remove question
            </button>
          ) : null}
        </div>
      ))}
      {questions.length < 8 ? (
        <button className="btn w-fit" type="button" onClick={() => onChange({ questions: [...questions, { prompt: "", code: "", options: ["", ""], answer: 0, explanation: "" }] })}>
          Add question
        </button>
      ) : null}
    </div>
  );
}

function TraceFields({ trace, onChange }: { trace: Trace; onChange: (trace: Trace) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Code">
        <textarea className="field min-h-40 font-mono text-xs" value={trace.code} onChange={(event) => onChange({ ...trace, code: event.target.value })} />
      </Field>
      {trace.checkpoints.map((checkpoint, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-2">
          <input
            className="field"
            placeholder="Checkpoint"
            value={checkpoint.prompt}
            onChange={(event) =>
              onChange({ ...trace, checkpoints: trace.checkpoints.map((item, i) => (i === index ? { ...item, prompt: event.target.value } : item)) })
            }
          />
          <input
            className="field font-mono text-sm"
            placeholder="Exact answer"
            value={checkpoint.answer}
            onChange={(event) =>
              onChange({ ...trace, checkpoints: trace.checkpoints.map((item, i) => (i === index ? { ...item, answer: event.target.value } : item)) })
            }
          />
        </div>
      ))}
      <button className="btn w-fit" type="button" onClick={() => onChange({ ...trace, checkpoints: [...trace.checkpoints, { prompt: "", answer: "" }] })}>
        Add checkpoint
      </button>
    </div>
  );
}

function FlagFields({ flags, onChange }: { flags: Flags; onChange: (flags: Flags) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {flags.steps.map((step, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            className="field"
            placeholder="Step"
            value={step.text}
            onChange={(event) => onChange({ steps: flags.steps.map((item, i) => (i === index ? { ...item, text: event.target.value } : item)) })}
          />
          <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={step.leak}
              onChange={(event) => onChange({ steps: flags.steps.map((item, i) => (i === index ? { ...item, leak: event.target.checked } : item)) })}
            />
            Leaks
          </label>
        </div>
      ))}
      <button className="btn w-fit" type="button" onClick={() => onChange({ steps: [...flags.steps, { text: "", leak: false }] })}>
        Add step
      </button>
    </div>
  );
}

function GovernanceFields({ governance, onChange }: { governance: Governance; onChange: (governance: Governance) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {governance.tools.map((tool, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <input
            className="field"
            placeholder="Tool"
            value={tool.description}
            onChange={(event) =>
              onChange({ ...governance, tools: governance.tools.map((item, i) => (i === index ? { ...item, description: event.target.value } : item)) })
            }
          />
          <select
            className="field field-block"
            value={tool.answer}
            onChange={(event) =>
              onChange({
                ...governance,
                tools: governance.tools.map((item, i) => (i === index ? { ...item, answer: event.target.value as "allow" | "ask" | "deny" } : item)),
              })
            }
          >
            <option value="allow">Allow</option>
            <option value="ask">Ask</option>
            <option value="deny">Deny</option>
          </select>
        </div>
      ))}
      <button className="btn w-fit" type="button" onClick={() => onChange({ ...governance, tools: [...governance.tools, { description: "", answer: "ask" }] })}>
        Add tool
      </button>
      {governance.gates.map((gate, index) => (
        <label key={index} className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            className="field"
            placeholder="Gate"
            value={gate.description}
            onChange={(event) =>
              onChange({ ...governance, gates: governance.gates.map((item, i) => (i === index ? { ...item, description: event.target.value } : item)) })
            }
          />
          <input
            type="checkbox"
            checked={gate.answer}
            onChange={(event) => onChange({ ...governance, gates: governance.gates.map((item, i) => (i === index ? { ...item, answer: event.target.checked } : item)) })}
          />
          On
        </label>
      ))}
      <button className="btn w-fit" type="button" onClick={() => onChange({ ...governance, gates: [...governance.gates, { description: "", answer: true }] })}>
        Add gate
      </button>
    </div>
  );
}

function ReviewFields({ review, onChange }: { review: Review; onChange: (review: Review) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {review.files.map((file, index) => (
        <div key={index} className="flex flex-col gap-2">
          <input
            className="field font-mono text-sm"
            placeholder="File name"
            value={file.name}
            onChange={(event) => onChange({ ...review, files: review.files.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)) })}
          />
          <textarea
            className="field min-h-32 font-mono text-xs"
            placeholder="File contents"
            value={file.content}
            onChange={(event) => onChange({ ...review, files: review.files.map((item, i) => (i === index ? { ...item, content: event.target.value } : item)) })}
          />
        </div>
      ))}
      {review.findings.map((finding, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-[#27272A] p-3">
          <div className="text-xs text-zinc-500">Finding {index + 1}</div>
          <input className="field" placeholder="File name" value={finding.file} onChange={(event) => onChange({ ...review, findings: review.findings.map((item, i) => (i === index ? { ...item, file: event.target.value } : item)) })} />
          <input className="field font-mono text-xs" placeholder="Anchor text from one line" value={finding.anchor} onChange={(event) => onChange({ ...review, findings: review.findings.map((item, i) => (i === index ? { ...item, anchor: event.target.value } : item)) })} />
          <input className="field" placeholder="Category" value={finding.category} onChange={(event) => onChange({ ...review, findings: review.findings.map((item, i) => (i === index ? { ...item, category: event.target.value } : item)) })} />
          <input className="field" placeholder="What is wrong" value={finding.summary} onChange={(event) => onChange({ ...review, findings: review.findings.map((item, i) => (i === index ? { ...item, summary: event.target.value } : item)) })} />
        </div>
      ))}
      <button className="btn w-fit" type="button" onClick={() => onChange({ ...review, findings: [...review.findings, { file: review.files[0]?.name ?? "", anchor: "", category: "", summary: "" }] })}>
        Add finding
      </button>
    </div>
  );
}

function TradeoffFields({ tradeoff, onChange }: { tradeoff: Tradeoff; onChange: (tradeoff: Tradeoff) => void }) {
  const number = (key: "requestsPerDay" | "inputTokens" | "outputTokens" | "latencyBudgetMs" | "monthlyBudget" | "accuracyBar", value: string) => {
    onChange({ ...tradeoff, [key]: Number(value) });
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Requests per day">
          <input className="field" type="number" value={tradeoff.requestsPerDay} onChange={(event) => number("requestsPerDay", event.target.value)} />
        </Field>
        <Field label="Input tokens">
          <input className="field" type="number" value={tradeoff.inputTokens} onChange={(event) => number("inputTokens", event.target.value)} />
        </Field>
        <Field label="Output tokens">
          <input className="field" type="number" value={tradeoff.outputTokens} onChange={(event) => number("outputTokens", event.target.value)} />
        </Field>
        <Field label="Latency budget (ms)">
          <input className="field" type="number" value={tradeoff.latencyBudgetMs} onChange={(event) => number("latencyBudgetMs", event.target.value)} />
        </Field>
        <Field label="Monthly budget">
          <input className="field" type="number" value={tradeoff.monthlyBudget} onChange={(event) => number("monthlyBudget", event.target.value)} />
        </Field>
        <Field label="Accuracy bar (0–1)">
          <input className="field" type="number" step="0.01" value={tradeoff.accuracyBar} onChange={(event) => number("accuracyBar", event.target.value)} />
        </Field>
      </div>
      {tradeoff.options.map((option, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-[#27272A] p-3 sm:grid-cols-2">
          <input className="field" placeholder="Option name" value={option.title} onChange={(event) => onChange({ ...tradeoff, options: tradeoff.options.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)) })} />
          <select className="field field-block" value={option.kind} onChange={(event) => onChange({ ...tradeoff, options: tradeoff.options.map((item, i) => (i === index ? { ...item, kind: event.target.value as Tradeoff["options"][number]["kind"] } : item)) })}>
            <option value="heuristic">Heuristic</option>
            <option value="api">API</option>
            <option value="instance">Instance</option>
          </select>
          <input className="field" type="number" placeholder="Input $ / million" value={option.inputPricePerMillion} onChange={(event) => onChange({ ...tradeoff, options: tradeoff.options.map((item, i) => (i === index ? { ...item, inputPricePerMillion: Number(event.target.value) } : item)) })} />
          <input className="field" type="number" placeholder="Output $ / million" value={option.outputPricePerMillion} onChange={(event) => onChange({ ...tradeoff, options: tradeoff.options.map((item, i) => (i === index ? { ...item, outputPricePerMillion: Number(event.target.value) } : item)) })} />
          <input className="field" type="number" placeholder="Instances" value={option.instances} onChange={(event) => onChange({ ...tradeoff, options: tradeoff.options.map((item, i) => (i === index ? { ...item, instances: Number(event.target.value) } : item)) })} />
          <input className="field" type="number" placeholder="Hourly" value={option.hourly} onChange={(event) => onChange({ ...tradeoff, options: tradeoff.options.map((item, i) => (i === index ? { ...item, hourly: Number(event.target.value) } : item)) })} />
          <input className="field" type="number" placeholder="Latency ms" value={option.latencyMs} onChange={(event) => onChange({ ...tradeoff, options: tradeoff.options.map((item, i) => (i === index ? { ...item, latencyMs: Number(event.target.value) } : item)) })} />
          <input className="field" type="number" step="0.01" placeholder="Accuracy 0–1" value={option.accuracy} onChange={(event) => onChange({ ...tradeoff, options: tradeoff.options.map((item, i) => (i === index ? { ...item, accuracy: Number(event.target.value) } : item)) })} />
        </div>
      ))}
      <Field label="Correct option">
        <select className="field field-block" value={tradeoff.correct} onChange={(event) => onChange({ ...tradeoff, correct: Number(event.target.value) })}>
          {tradeoff.options.map((option, index) => (
            <option key={index} value={index}>
              {index + 1}. {option.title || "Untitled"}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
