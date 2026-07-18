/**
 * Shared types for the Data Layer repositories.
 */

/** Viewer identity passed to repository methods. */
export interface ViewerContext {
  accountType?: "club" | "student";
  id?: string;
  username: string;
}
