import { resolveEventAccess, type EventAccessKind } from "../../../data/policies/eventAccess";
import { type RelationSnapshot } from "../../../data/policies/visibility";
import type { EventWithMeta } from "../../../data/contracts/content";

export type { EventAccessKind, RelationSnapshot };

export function resolveEventAccessInfo(event: EventWithMeta) {
  return resolveEventAccess(event);
}
