import { resolveEventAccess } from "../../../data/policies/eventAccess";
import type { EventWithMeta } from "../data";

export function resolveSearchEventAccess(event: EventWithMeta) {
  return resolveEventAccess(event);
}
