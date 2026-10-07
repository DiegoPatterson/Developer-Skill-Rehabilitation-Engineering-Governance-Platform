import { z } from "zod";

export type PathDraft = {
  topic: string;
  description: string;
  lessonNumbers: number[];
};

export type PathLessonChoice = {
  number: number;
  title: string;
  category: string;
  difficulty: number;
};

export type PublishedPath = {
  id: string;
  topic: string;
  description: string;
  steps: number[];
};

const schema = z.object({
  topic: z.string().trim().min(2, "Name the topic in at least 2 characters.").max(40, "Keep the topic to 40 characters."),
  description: z
    .string()
    .trim()
    .min(10, "Describe the path in at least 10 characters.")
    .max(400, "Keep the description to 400 characters."),
  lessonNumbers: z.array(z.number().int().positive()).min(1, "Add at least one lesson.").max(12, "A path can hold 12 lessons."),
});

export function parsePathProposal(
  input: unknown,
  active: ReadonlySet<number>,
): { ok: true; draft: PathDraft } | { ok: false; error: string } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That path is incomplete." };
  const numbers = parsed.data.lessonNumbers;
  if (new Set(numbers).size !== numbers.length) return { ok: false, error: "List each lesson once." };
  for (const number of numbers) {
    if (!active.has(number)) return { ok: false, error: `Lesson #${number} is not in the catalog.` };
  }
  return { ok: true, draft: parsed.data };
}
