export function patchScore(correctness: number, performance: number, maintainability: number): number {
  const raw = 0.7 * correctness + 0.15 * performance + 0.15 * maintainability;
  return Math.round(Math.max(0, Math.min(1, raw)) * 100);
}

export function f1(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

export function jaccard(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}
