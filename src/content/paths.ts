export type LessonPath = {
  id: string;
  title: string;
  blurb: string;
  steps: number[];
};

/** Fixed routes. New lessons stay in the catalog until a path lists their number. */
export const LESSON_PATHS: LessonPath[] = [
  {
    id: "debugging",
    title: "Debugging",
    blurb: "Follow one bug from a bad transfer, through a lost update, to checkout.",
    steps: [1, 4, 8],
  },
  {
    id: "boundaries",
    title: "Boundaries",
    blurb: "One lesson on the edges of a page of results.",
    steps: [2],
  },
  {
    id: "reading",
    title: "Reading code",
    blurb: "Say what the code does, read the branches, then review a pull request.",
    steps: [3, 7, 12],
  },
  {
    id: "security",
    title: "Security",
    blurb: "Stop injection, check who can see an invoice, then gate the tools.",
    steps: [5, 9, 13],
  },
  {
    id: "performance",
    title: "Performance",
    blurb: "Name the cost, then see it at scale and in the event loop.",
    steps: [6, 10, 14],
  },
  {
    id: "models",
    title: "Models",
    blurb: "Pick a model family, find leaked data, then judge the cost.",
    steps: [11, 15, 18],
  },
  {
    id: "systems",
    title: "Building systems",
    blurb: "Write the spec, audit an agent diff, then set the gates.",
    steps: [16, 17, 19],
  },
];

const byId = new Map(LESSON_PATHS.map((path) => [path.id, path]));

export function lessonPath(id: string): LessonPath {
  return byId.get(id) ?? LESSON_PATHS[0];
}

export function pathForLesson(number: number): LessonPath | undefined {
  return LESSON_PATHS.find((path) => path.steps.includes(number));
}

export function pathTopics(number: number, extra: { topic: string; steps: number[] }[]): string[] {
  const topics: string[] = [];
  for (const path of LESSON_PATHS) {
    if (path.steps.includes(number)) topics.push(path.title);
  }
  for (const path of extra) {
    if (path.steps.includes(number) && !topics.includes(path.topic)) topics.push(path.topic);
  }
  return topics;
}

export function pathDifficulty(levels: number[]): { min: number; max: number } | null {
  if (levels.length === 0) return null;
  let min = levels[0];
  let max = levels[0];
  for (const level of levels) {
    if (level < min) min = level;
    if (level > max) max = level;
  }
  return { min, max };
}

export function formatPathDifficulty(levels: number[]): string {
  const span = pathDifficulty(levels);
  if (!span) return "—";
  return span.min === span.max ? String(span.min) : `${span.min}–${span.max}`;
}

export function formatProblemCount(count: number): string {
  return count === 1 ? "1 problem" : `${count} problems`;
}

const PATH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLearningPathId(id: string): boolean {
  return byId.has(id) || PATH_UUID.test(id);
}

/** Newest favorites come first. Paths that are not favorited keep their catalog order. */
export function orderFavoritedFirst<T extends { id: string }>(paths: readonly T[], favoriteIds: readonly string[]): T[] {
  const byPath = new Map(paths.map((path) => [path.id, path]));
  const used = new Set<string>();
  const first: T[] = [];
  for (const id of favoriteIds) {
    const path = byPath.get(id);
    if (!path || used.has(id)) continue;
    used.add(id);
    first.push(path);
  }
  return [...first, ...paths.filter((path) => !used.has(path.id))];
}
