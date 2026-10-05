export type CostOption = {
  id: string;
  title: string;
  kind: "api" | "instance" | "heuristic";
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
  instances?: number;
  hourly?: number;
  latencyMs: number;
  accuracy: number;
  note: string;
};

export type CostScenario = {
  requestsPerDay: number;
  inputTokens: number;
  outputTokens: number;
  latencyBudgetMs: number;
  monthlyBudget: number;
  accuracyBar: number;
  days?: number;
};

export function monthlyCost(option: CostOption, scenario: CostScenario): number {
  const days = scenario.days ?? 30;
  const requests = scenario.requestsPerDay * days;
  if (option.kind === "heuristic") return 0;
  if (option.kind === "instance") return (option.instances ?? 0) * (option.hourly ?? 0) * 730;
  const input = ((requests * scenario.inputTokens) / 1e6) * (option.inputPricePerMillion ?? 0);
  const output = ((requests * scenario.outputTokens) / 1e6) * (option.outputPricePerMillion ?? 0);
  return input + output;
}

export function assessOption(option: CostOption, scenario: CostScenario) {
  const cost = monthlyCost(option, scenario);
  const latencyOk = option.latencyMs <= scenario.latencyBudgetMs;
  const budgetOk = cost <= scenario.monthlyBudget;
  const accuracyOk = option.accuracy >= scenario.accuracyBar;
  return { cost, latencyOk, budgetOk, accuracyOk, fits: latencyOk && budgetOk && accuracyOk };
}
