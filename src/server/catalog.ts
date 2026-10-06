import "server-only";
import { canReview, type UserRole } from "@/content/roles";
import { getDb, refreshLiveCatalog } from "./db";

const NODE_ID = /^[a-z0-9-]{1,100}$/;

export class CatalogError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type CatalogPatch = {
  showInGraph?: boolean;
  active?: boolean;
  positionX?: number | null;
  positionY?: number | null;
};

export async function updateCatalogNode(role: UserRole, id: string, patch: CatalogPatch): Promise<void> {
  if (!canReview(role)) throw new CatalogError(403, "Only an admin can change lessons.");
  if (!NODE_ID.test(id)) throw new CatalogError(400, "That lesson was not found.");
  const hasPosition = patch.positionX !== undefined || patch.positionY !== undefined;
  if (hasPosition && (patch.positionX == null) !== (patch.positionY == null)) {
    throw new CatalogError(400, "Save both coordinates, or clear both.");
  }
  if (patch.positionX != null && (patch.positionX < -20000 || patch.positionX > 20000)) {
    throw new CatalogError(400, "That position is off the tree.");
  }
  if (patch.positionY != null && (patch.positionY < -20000 || patch.positionY > 20000)) {
    throw new CatalogError(400, "That position is off the tree.");
  }
  const touches =
    patch.showInGraph !== undefined || patch.active !== undefined || patch.positionX !== undefined || patch.positionY !== undefined;
  if (!touches) throw new CatalogError(400, "Nothing to change.");

  const db = getDb();
  const existing = await db.skillNode.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new CatalogError(404, "That lesson was not found.");

  const data: {
    showInGraph?: boolean;
    active?: boolean;
    positionX?: number | null;
    positionY?: number | null;
  } = {};
  if (patch.active !== undefined) data.active = patch.active;
  if (patch.showInGraph === true) data.showInGraph = true;
  if (patch.showInGraph === false) {
    data.showInGraph = false;
    data.positionX = null;
    data.positionY = null;
  }
  if (hasPosition && patch.showInGraph !== false) {
    data.positionX = patch.positionX ?? null;
    data.positionY = patch.positionY ?? null;
    if (patch.positionX != null && patch.positionY != null) data.showInGraph = true;
  }
  await db.skillNode.update({ where: { id }, data });
  await refreshLiveCatalog();
}
