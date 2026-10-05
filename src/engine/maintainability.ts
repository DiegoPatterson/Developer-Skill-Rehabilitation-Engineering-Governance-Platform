function nonempty(code: string): number {
  return code.split("\n").filter((line) => line.trim().length > 0).length;
}

function maxBraceDepth(code: string): number {
  let depth = 0;
  let max = 0;
  for (const char of code) {
    if (char === "{") {
      depth += 1;
      max = Math.max(max, depth);
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
    }
  }
  return max;
}

export function maintainabilityScore(code: string, reference: string): number {
  let score = 1;
  const lines = nonempty(code);
  const referenceLines = Math.max(1, nonempty(reference));
  if (lines > referenceLines * 2.5 + 15) score -= 0.2;
  if (lines < referenceLines && lines < Math.max(4, referenceLines * 0.35)) score -= 0.25;
  if (/\beval\s*\(|new\s+Function\s*\(/.test(code)) score -= 0.5;
  if (code.split("\n").some((line) => line.length > 140)) score -= 0.1;
  if (maxBraceDepth(code) > maxBraceDepth(reference) + 3) score -= 0.15;
  return Math.max(0, Math.min(1, score));
}
