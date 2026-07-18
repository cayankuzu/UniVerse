import { resolveEventAccess } from "../../../data/policies/eventAccess";
import type { EventWithMeta } from "../data";

export function resolveProfileEventAccess(event: EventWithMeta) {
  return resolveEventAccess(event);
}
