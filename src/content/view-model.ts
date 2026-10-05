import type { CostOption, CostScenario } from "@/engine/cost";
import type { PublicChallenge } from "./types";

export type GraphStatus = "locked" | "in_progress" | "mastered";

export type GraphNodeView = {
  id: string;
  number: number;
  title: string;
  category: string;
  summary: string;
  difficulty: number;
  x: number;
  y: number;
  prereqs: string[];
  status: GraphStatus;
  inGraph: boolean;
  href: string;
};

export type CfgView = {
  nodes: { id: string; label: string; kind: string; unreachable: boolean }[];
  edges: { id: string; source: string; target: string; label: string }[];
};

export type WorkspaceView = PublicChallenge & {
  locked: boolean;
  missing: { id: string; title: string; number: number }[];
  scenario: CostScenario | null;
  options: CostOption[];
  cfg: CfgView | null;
  traceFile: string | null;
};

export type AttemptView = {
  id: string;
  startedAt: string;
  deadlineAt: string | null;
  hintsUsed: number;
  hints: string[];
};

export type SkillLink = { id: string; title: string; number: number };
