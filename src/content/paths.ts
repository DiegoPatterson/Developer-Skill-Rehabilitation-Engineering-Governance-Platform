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
