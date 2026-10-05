import { localToday } from "./dates";

export type HeatCell = { date: string; count: number };

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return sorted[mid];
}

/** Sixteen week columns, Sunday through Saturday. An empty date is a future day in the current week. */
export function buildHeatmap(active: string[], now = new Date()): HeatCell[] {
  const counts = new Map<string, number>();
  for (const day of active) counts.set(day, (counts.get(day) ?? 0) + 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(end.getDate() - end.getDay() - 7 * 15);
  const cells: HeatCell[] = [];
  const cursor = new Date(start);
  for (let index = 0; index < 16 * 7; index += 1) {
    if (cursor.getTime() > end.getTime()) {
      cells.push({ date: "", count: 0 });
    } else {
      const date = localToday(cursor);
      cells.push({ date, count: counts.get(date) ?? 0 });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}
