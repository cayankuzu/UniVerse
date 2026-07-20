import type { ProjectionFreshnessPolicy } from "./projectionFreshness";
import { resolveProjectionPerformanceBudget, type ProjectionSurface } from "../performanceBudget";

function policyFor(surface: ProjectionSurface): Partial<ProjectionFreshnessPolicy> {
  const budget = resolveProjectionPerformanceBudget(surface);
  return {
    firstOpenPolicy: budget.firstOpenPolicy,
    freshnessSlaMs: budget.freshnessSlaMs,
    prefetchPolicy: budget.prefetchPolicy,
    realtimeScope: budget.realtimeScope,
    refreshMode: budget.refreshMode,
  };
}

export const HOME_PROJECTION_POLICY = policyFor("home");
export const SEARCH_PROJECTION_POLICY = policyFor("search");
export const PROFILE_PROJECTION_POLICY = policyFor("profile");
export const VIEW_PROFILE_PROJECTION_POLICY = policyFor("view-profile");
export const NOTIFICATIONS_PROJECTION_POLICY = policyFor("notifications");
export const EVENT_DETAIL_PROJECTION_POLICY = policyFor("event-detail");
export const RELATIONSHIP_PROJECTION_POLICY = policyFor("relationships");
export const BLOCKED_USERS_PROJECTION_POLICY = policyFor("blocked-users");
