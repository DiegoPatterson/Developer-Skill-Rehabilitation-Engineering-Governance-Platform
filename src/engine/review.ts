import { f1 } from "./score";

export type ReviewComment = {
  file: string;
  line: number;
  category: string;
  text: string;
};

export type ReviewFinding = {
  file: string;
  anchor: string;
  category: string;
  tolerance: number;
  summary: string;
};

export function lineOf(source: string, anchor: string): number {
  const lines = source.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(anchor));
  if (index < 0) throw new Error(`Anchor not found: ${anchor}`);
  return index + 1;
}

export function scoreReview(
  comments: ReviewComment[],
  findings: ReviewFinding[],
  files: Record<string, string>,
): { precision: number; recall: number; f1: number; score: number; missed: string[] } {
  const located = findings.map((finding) => ({
    ...finding,
    line: lineOf(files[finding.file] ?? "", finding.anchor),
  }));
  const valid = comments.filter((comment) => comment.text.trim().length >= 8 && Number.isInteger(comment.line));
  const used = new Set<number>();
  let matched = 0;
  for (const comment of valid) {
    const index = located.findIndex(
      (finding, findingIndex) =>
        !used.has(findingIndex) &&
        finding.file === comment.file &&
        finding.category === comment.category &&
        Math.abs(finding.line - comment.line) <= finding.tolerance,
    );
    if (index >= 0) {
      used.add(index);
      matched += 1;
    }
  }
  const precision = valid.length === 0 ? 0 : matched / valid.length;
  const recall = located.length === 0 ? 1 : matched / located.length;
  const harmonic = f1(precision, recall);
  return {
    precision,
    recall,
    f1: harmonic,
    score: Math.round(harmonic * 100),
    missed: located.filter((_, index) => !used.has(index)).map((finding) => finding.summary),
  };
}
