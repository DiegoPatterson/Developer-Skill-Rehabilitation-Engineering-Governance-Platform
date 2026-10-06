import type { CostOption, CostScenario } from "@/engine/cost";

export type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "code"; text: string };

export type Category =
  | "debugging"
  | "security"
  | "comprehension"
  | "performance"
  | "architecture"
  | "ml";

export type ChallengeKind =
  | "patch"
  | "incident"
  | "trace"
  | "review"
  | "choice"
  | "spec"
  | "flags"
  | "governance"
  | "tradeoff";

export type CodeFile = {
  name: string;
  starter: string;
  solution: string;
  traceSource?: string;
};

export type TraceScenario = {
  id: string;
  label: string;
  argsPreview: string;
  entry: string;
  args: unknown[];
};

export type ChoiceQuestion = {
  id: string;
  prompt: string;
  code?: string;
  options: { id: string; label: string }[];
  answer: string;
  explanation: string;
};

export type Checkpoint = { id: string; prompt: string; answer: string };

export type ReviewFile = { name: string; content: string };

export type Finding = {
  file: string;
  anchor: string;
  category: string;
  tolerance: number;
  summary: string;
};

export type PipelineStep = { id: string; text: string; leak: boolean };

export type PolicyTool = { id: string; description: string; answer: "allow" | "ask" | "deny" };
export type PolicyGate = { id: string; description: string; answer: boolean };

export type Challenge = {
  id: string;
  /** Stable catalog number. New lessons take the next integer. Do not renumber. */
  number: number;
  title: string;
  label?: string;
  category: Category;
  difficulty: number;
  summary: string;
  showInGraph: boolean;
  prereqs: string[];
  /** True when an admin has saved x and y. Otherwise the tree lays the card out. */
  placed?: boolean;
  x: number;
  y: number;
  kind: ChallengeKind;
  timeLimitMinutes?: number;
  brief: Block[];
  constraints: string[];
  signature: string;
  hints: string[];
  debrief: Block[];
  files?: CodeFile[];
  steps?: Record<string, unknown>[];
  scenarios?: TraceScenario[];
  questions?: ChoiceQuestion[];
  checkpoints?: Checkpoint[];
  traceCode?: string;
  reviewFiles?: ReviewFile[];
  findings?: Finding[];
  categories?: string[];
  pipeline?: PipelineStep[];
  tools?: PolicyTool[];
  gates?: PolicyGate[];
  cfgSource?: string;
  scenario?: CostScenario;
  options?: CostOption[];
  correctOptionId?: string;
};

export type PublicChallenge = {
  id: string;
  number: number;
  title: string;
  label: string;
  category: Category;
  difficulty: number;
  summary: string;
  kind: ChallengeKind;
  timeLimitMinutes?: number;
  brief: Block[];
  constraints: string[];
  signature: string;
  hintCount: number;
  files: { name: string; starter: string }[];
  tests: { name: string }[];
  scenarios: { id: string; label: string; argsPreview: string }[];
  questions: { id: string; prompt: string; code?: string; options: { id: string; label: string }[] }[];
  checkpoints: { id: string; prompt: string }[];
  traceCode?: string;
  reviewFiles: ReviewFile[];
  categories: string[];
  pipeline: { id: string; text: string }[];
  tools: { id: string; description: string }[];
  gates: { id: string; description: string }[];
  showCfg: boolean;
};
