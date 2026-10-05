export const SKILL_CARD = { width: 220, height: 148, gapX: 72, gapY: 36 } as const;

const TRACK: Record<string, number> = {
  debugging: 0,
  comprehension: 1,
  security: 2,
  architecture: 3,
  performance: 4,
  ml: 5,
};

export type SkillLayoutInput = { id: string; prereqs: string[]; category?: string; number?: number };

export type SkillLayout = {
  positions: Map<string, { x: number; y: number }>;
  order: string[];
};

export function layoutSkillGraph(
  nodes: SkillLayoutInput[],
  card: { width: number; height: number; gapX: number; gapY: number } = SKILL_CARD,
): SkillLayout {
  const ids = new Set(nodes.map((node) => node.id));
  const prereqs = new Map(nodes.map((node) => [node.id, node.prereqs.filter((id) => ids.has(id))]));
  const numberOf = new Map(nodes.map((node) => [node.id, node.number ?? 0]));
  const homeRow = new Map(nodes.map((node) => [node.id, (TRACK[node.category ?? ""] ?? 6) * 2]));
  const depth = new Map<string, number>();
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known != null) return known;
    const parents = prereqs.get(id) ?? [];
    const value = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(depthOf));
    depth.set(id, value);
    return value;
  };
  for (const node of nodes) depthOf(node.id);

  const columns = new Map<number, string[]>();
  for (const node of nodes) {
    const column = depth.get(node.id) ?? 0;
    const list = columns.get(column) ?? [];
    list.push(node.id);
    columns.set(column, list);
  }

  const rowOf = new Map<string, number>();
  const maxColumn = Math.max(0, ...columns.keys());
  for (let column = 0; column <= maxColumn; column += 1) {
    const list = columns.get(column) ?? [];
    const desired = (id: string) => {
      const parents = prereqs.get(id) ?? [];
      if (parents.length === 0) return homeRow.get(id) ?? 0;
      return parents.reduce((sum, parent) => sum + (rowOf.get(parent) ?? homeRow.get(parent) ?? 0), 0) / parents.length;
    };
    const sorted = [...list].sort(
      (a, b) => desired(a) - desired(b) || (numberOf.get(a) ?? 0) - (numberOf.get(b) ?? 0) || a.localeCompare(b),
    );
    let last = -1;
    for (const id of sorted) {
      const row = Math.max(Math.round(desired(id)), last + 1);
      rowOf.set(id, row);
      last = row;
    }
  }

  const pitchX = card.width + card.gapX;
  const pitchY = card.height + card.gapY;
  const positions = new Map<string, { x: number; y: number }>();
  const order: string[] = [];
  for (let column = 0; column <= maxColumn; column += 1) {
    const list = [...(columns.get(column) ?? [])].sort((a, b) => (rowOf.get(a) ?? 0) - (rowOf.get(b) ?? 0));
    for (const id of list) {
      positions.set(id, { x: column * pitchX, y: (rowOf.get(id) ?? 0) * pitchY });
      order.push(id);
    }
  }
  let minY = Number.POSITIVE_INFINITY;
  for (const position of positions.values()) minY = Math.min(minY, position.y);
  if (Number.isFinite(minY) && minY > 0) {
    for (const position of positions.values()) position.y -= minY;
  }
  return { positions, order };
}

export function skillCardsOverlap(
  positions: Map<string, { x: number; y: number }>,
  card: { width: number; height: number } = SKILL_CARD,
): boolean {
  const boxes = [...positions.values()];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (!a || !b) continue;
      const separated = a.x + card.width <= b.x || b.x + card.width <= a.x || a.y + card.height <= b.y || b.y + card.height <= a.y;
      if (!separated) return true;
    }
  }
  return false;
}
