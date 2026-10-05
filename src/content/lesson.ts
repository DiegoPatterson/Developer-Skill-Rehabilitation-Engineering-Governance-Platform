export const LESSON_TYPES = [
  ["debugging", "Debugging"],
  ["security", "Security"],
  ["comprehension", "Comprehension"],
  ["performance", "Performance"],
  ["architecture", "Architecture"],
  ["ml", "ML"],
] as const;

export type LessonSort = "number" | "title" | "difficulty" | "difficulty-desc" | "category";

export type LessonFilter = {
  query: string;
  category: string;
  difficulty: number | null;
};

export type TrackContinuation = {
  sourceId: string;
  sourceNumber: number;
  sourceTitle: string;
  targetId: string;
  targetNumber: number;
  targetTitle: string;
  targetCategory: string;
};

export function lessonTypeLabel(category: string): string {
  for (const [id, label] of LESSON_TYPES) {
    if (id === category) return label;
  }
  return category;
}

export function trackContinuations(
  lessons: { id: string; number: number; title: string; category: string; prereqs: string[] }[],
  track: string,
): TrackContinuation[] {
  const onTrack = new Map(lessons.filter((lesson) => lesson.category === track).map((lesson) => [lesson.id, lesson]));
  const links: TrackContinuation[] = [];
  for (const lesson of lessons) {
    if (lesson.category === track) continue;
    for (const prereq of lesson.prereqs) {
      const source = onTrack.get(prereq);
      if (!source) continue;
      links.push({
        sourceId: source.id,
        sourceNumber: source.number,
        sourceTitle: source.title,
        targetId: lesson.id,
        targetNumber: lesson.number,
        targetTitle: lesson.title,
        targetCategory: lesson.category,
      });
    }
  }
  links.sort((a, b) => a.sourceNumber - b.sourceNumber || a.targetNumber - b.targetNumber || a.targetId.localeCompare(b.targetId));
  return links;
}

export function formatLessonNumber(number: number): string {
  return `#${number}`;
}

export function formatRequirement(numbers: number[]): string {
  const labels = [...new Set(numbers)].sort((a, b) => a - b).map(formatLessonNumber);
  if (labels.length === 0) return "";
  if (labels.length === 1) return `Needs ${labels[0]}`;
  if (labels.length === 2) return `Needs ${labels[0]} and ${labels[1]}`;
  return `Needs ${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function lessonMatches(
  lesson: { number: number; title: string; category: string; id: string },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const bare = q.startsWith("#") ? q.slice(1) : q;
  if (/^\d+$/.test(bare) && lesson.number === Number(bare)) return true;
  return lesson.title.toLowerCase().includes(q) || lesson.category.toLowerCase().includes(q) || lesson.id.toLowerCase().includes(q);
}

export function lessonVisible(
  lesson: { number: number; title: string; category: string; id: string; difficulty: number },
  filter: LessonFilter,
): boolean {
  if (filter.category && lesson.category !== filter.category) return false;
  if (filter.difficulty != null && lesson.difficulty !== filter.difficulty) return false;
  return lessonMatches(lesson, filter.query);
}

export function compareLessons(sort: LessonSort) {
  return (
    a: { number: number; title: string; category: string; difficulty: number },
    b: { number: number; title: string; category: string; difficulty: number },
  ) => {
    const byNumber = a.number - b.number;
    if (sort === "title") return a.title.localeCompare(b.title) || byNumber;
    if (sort === "difficulty") return a.difficulty - b.difficulty || byNumber;
    if (sort === "difficulty-desc") return b.difficulty - a.difficulty || byNumber;
    if (sort === "category") return a.category.localeCompare(b.category) || byNumber;
    return byNumber;
  };
}
