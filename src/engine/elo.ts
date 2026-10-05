export function challengeRating(difficulty: number): number {
  return 1000 + difficulty * 160;
}

export function expectedScore(player: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - player) / 400));
}

export function nextElo(player: number, opponent: number, score: number, k = 24): number {
  const clamped = Math.max(0, Math.min(1, score));
  const next = player + k * (clamped - expectedScore(player, opponent));
  return Math.round(Math.max(100, next));
}

export function overallElo(categories: number[]): number {
  if (categories.length === 0) return 1200;
  const total = categories.reduce((sum, value) => sum + value, 0);
  return Math.round(total / categories.length);
}
