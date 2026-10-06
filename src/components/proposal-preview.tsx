import { lessonTypeLabel } from "@/content/lesson";
import { proposalKindLabel, type ProposalDraft } from "@/content/proposal";

function Block({ title, children }: { title: string; children: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-xs uppercase tracking-wide text-zinc-500">{title}</h2>
      <pre className="overflow-auto whitespace-pre-wrap rounded-lg border border-[#27272A] bg-[#121215] p-3 font-mono text-xs text-zinc-200">{children}</pre>
    </section>
  );
}

export function ProposalPreview({ draft }: { draft: ProposalDraft }) {
  return (
    <div className="flex flex-col gap-4 text-sm text-zinc-300">
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-zinc-500">Label</dt>
          <dd>{draft.label}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Name</dt>
          <dd>{draft.title}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Track</dt>
          <dd>{lessonTypeLabel(draft.category)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Question type</dt>
          <dd>{proposalKindLabel(draft.kind)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Difficulty</dt>
          <dd>{draft.difficulty}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">On the tree</dt>
          <dd>{draft.showInGraph ? "Yes" : "List only"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Prerequisites</dt>
          <dd>{draft.prereqNumbers.length ? draft.prereqNumbers.map((number) => `#${number}`).join(", ") : "None"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Signature</dt>
          <dd className="font-mono text-xs">{draft.signature || "None"}</dd>
        </div>
      </dl>
      <section>
        <h2 className="text-xs uppercase tracking-wide text-zinc-500">Description</h2>
        <p className="mt-1 whitespace-pre-wrap">{draft.description}</p>
      </section>
      {draft.constraints.length ? (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-zinc-500">Rules</h2>
          <ul className="mt-1 list-disc pl-5">
            {draft.constraints.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {draft.hints.length ? (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-zinc-500">Hints</h2>
          <ol className="mt-1 list-decimal pl-5">
            {draft.hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ol>
        </section>
      ) : null}
      {draft.debrief ? (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-zinc-500">Debrief</h2>
          <p className="mt-1 whitespace-pre-wrap">{draft.debrief}</p>
        </section>
      ) : null}
      {draft.patch ? (
        <>
          <Block title={`Starter · ${draft.patch.fileName}`}>{draft.patch.starter}</Block>
          <Block title="Reference solution">{draft.patch.solution}</Block>
          <Block title="Tests">
            {draft.patch.tests
              .map((test) =>
                test.mode === "throws"
                  ? `${test.name}: ${test.entry}(${test.argsText}) throws including ${test.messageIncludes}`
                  : `${test.name}: ${test.entry}(${test.argsText}) returns ${test.expectText}`,
              )
              .join("\n\n")}
          </Block>
        </>
      ) : null}
      {draft.choice
        ? draft.choice.questions.map((question, index) => (
            <section key={question.prompt}>
              <h2 className="text-xs uppercase tracking-wide text-zinc-500">Question {index + 1}</h2>
              <p className="mt-1">{question.prompt}</p>
              {question.code ? <pre className="mt-2 overflow-auto font-mono text-xs text-zinc-400">{question.code}</pre> : null}
              <ul className="mt-2 list-decimal pl-5">
                {question.options.map((option, optionIndex) => (
                  <li key={option} className={optionIndex === question.answer ? "text-[#4ADE80]" : undefined}>
                    {option}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-zinc-400">{question.explanation}</p>
            </section>
          ))
        : null}
      {draft.trace ? (
        <>
          <Block title="Trace">{draft.trace.code}</Block>
          <ul className="list-disc pl-5">
            {draft.trace.checkpoints.map((checkpoint) => (
              <li key={checkpoint.prompt}>
                {checkpoint.prompt}: <span className="font-mono text-[#4ADE80]">{checkpoint.answer}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {draft.flags ? (
        <ul className="list-disc pl-5">
          {draft.flags.steps.map((step) => (
            <li key={step.text}>
              {step.text} {step.leak ? <span className="text-[#4ADE80]">leaks</span> : <span className="text-zinc-500">clean</span>}
            </li>
          ))}
        </ul>
      ) : null}
      {draft.governance ? (
        <>
          <ul className="list-disc pl-5">
            {draft.governance.tools.map((tool) => (
              <li key={tool.description}>
                {tool.description}: {tool.answer}
              </li>
            ))}
          </ul>
          <ul className="list-disc pl-5">
            {draft.governance.gates.map((gate) => (
              <li key={gate.description}>
                {gate.description}: {gate.answer ? "on" : "off"}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {draft.review ? (
        <>
          {draft.review.files.map((file) => (
            <Block key={file.name} title={file.name}>
              {file.content}
            </Block>
          ))}
          <ul className="list-disc pl-5">
            {draft.review.findings.map((finding) => (
              <li key={`${finding.file}-${finding.anchor}`}>
                {finding.file} · {finding.category} · {finding.anchor} · {finding.summary}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {draft.tradeoff ? (
        <ul className="list-disc pl-5">
          {draft.tradeoff.options.map((option, index) => (
            <li key={option.title} className={index === draft.tradeoff?.correct ? "text-[#4ADE80]" : undefined}>
              {option.title} · {option.kind} · {option.latencyMs} ms · accuracy {option.accuracy}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
