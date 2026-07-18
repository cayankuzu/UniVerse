import type { SearchProjectionParams } from "./projections.types";

export const SEARCH_DISCOVERY_SCOPE = "__discovery__:newest";
export const SEARCH_DISCOVERY_KINDS = [
  "albums",
  "events",
  "clubs",
  "students",
] as const satisfies readonly SearchProjectionParams["kind"][];
