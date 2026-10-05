export type SpecEndpoint = {
  method: string;
  path: string;
  auth: string;
  errors: string;
  request: string;
  response: string;
};

export type SpecEntity = { name: string; fields: string };

export type SpecInput = {
  title: string;
  summary: string;
  nonGoals: string;
  endpoints: SpecEndpoint[];
  entities: SpecEntity[];
  acceptance: string;
};

export type SpecCheck = { id: string; ok: boolean; points: number; detail: string };

function includesAny(text: string, words: string[]): boolean {
  const hay = text.toLowerCase();
  return words.some((word) => hay.includes(word));
}

export function scoreSpec(input: SpecInput): { score: number; checks: SpecCheck[] } {
  const endpoints = input.endpoints ?? [];
  const entities = input.entities ?? [];
  const evaluate = endpoints.find(
    (endpoint) => /get/i.test(endpoint.method) && /flag|evaluat/i.test(endpoint.path),
  );
  const errorText = endpoints.map((endpoint) => endpoint.errors).join(" ");
  const entityText = entities.map((entity) => `${entity.name} ${entity.fields}`).join(" ");
  const flagEntity = entities.find((entity) => /flag/i.test(entity.name));
  const checks: SpecCheck[] = [
    {
      id: "summary",
      points: 10,
      ok: input.summary.trim().length >= 40,
      detail: "Summary is at least 40 characters and says what the client needs.",
    },
    {
      id: "nongoals",
      points: 10,
      ok: input.nonGoals.trim().length >= 20,
      detail: "Non-goals are explicit.",
    },
    {
      id: "evaluate",
      points: 15,
      ok: Boolean(evaluate),
      detail: "A GET endpoint evaluates a flag.",
    },
    {
      id: "auth",
      points: 10,
      ok: Boolean(evaluate) && includesAny(evaluate?.auth ?? "", ["bearer", "api key", "apikey", "session"]),
      detail: "The evaluate endpoint names its auth.",
    },
    {
      id: "errors",
      points: 15,
      ok: /\b400\b/.test(errorText) && /\b401\b/.test(errorText),
      detail: "Errors include 400 and 401.",
    },
    {
      id: "flag-entity",
      points: 15,
      ok: Boolean(flagEntity) && /key/i.test(flagEntity?.fields ?? "") && /default/i.test(flagEntity?.fields ?? ""),
      detail: "A Flag entity has a key and a default.",
    },
    {
      id: "rule",
      points: 10,
      ok: /rule|segment|condition/i.test(entityText),
      detail: "Targeting is modeled as a rule, segment, or condition.",
    },
    {
      id: "acceptance",
      points: 15,
      ok: /missing/i.test(input.acceptance) && /default/i.test(input.acceptance),
      detail: "Acceptance says what happens when the flag is missing: the default.",
    },
  ];
  let score = checks.reduce((sum, check) => sum + (check.ok ? check.points : 0), 0);
  const scopeCreep = endpoints.some((endpoint) => /delete/i.test(endpoint.method) && /user/i.test(endpoint.path));
  if (scopeCreep) score -= 20;
  return { score: Math.max(0, Math.min(100, score)), checks };
}
