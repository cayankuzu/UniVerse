import type { ProjectionFreshnessPolicy } from "./projectionFreshness";
import { resolveProjectionPerformanceBudget } from "../performanceBudget";

/**
 * Instagram-style projection policies:
 * - Always show last-known-content (never show skeleton on re-entry)
 * - Background sync keeps data fresh without blocking UI
 * - Eager prefetch ensures data is ready before user navigates
 */

const homeBudget = resolveProjectionPerformanceBudget("home");
const searchBudget = resolveProjectionPerformanceBudget("search");
const profileBudget = resolveProjectionPerformanceBudget("profile");
const viewProfileBudget = resolveProjectionPerformanceBudget("view-profile");
const notificationsBudget = resolveProjectionPerformanceBudget("notifications");
const eventDetailBudget = resolveProjectionPerformanceBudget("event-detail");
const relationshipsBudget = resolveProjectionPerformanceBudget("relationships");
const blockedUsersBudget = resolveProjectionPerformanceBudget("blocked-users");

export const HOME_PROJECTION_POLICY = {
  firstOpenPolicy: homeBudget.firstOpenPolicy,
  freshnessSlaMs: homeBudget.freshnessSlaMs,
  prefetchPolicy: homeBudget.prefetchPolicy,
  realtimeScope: homeBudget.realtimeScope,
  refreshMode: homeBudget.refreshMode,
} satisfies Partial<ProjectionFreshnessPolicy>;

export const SEARCH_PROJECTION_POLICY = {
  firstOpenPolicy: searchBudget.firstOpenPolicy,
  freshnessSlaMs: searchBudget.freshnessSlaMs,
  prefetchPolicy: searchBudget.prefetchPolicy,
  realtimeScope: searchBudget.realtimeScope,
  // Search visibility depends on account privacy, so full refreshes are safer than deltas.
  refreshMode: searchBudget.refreshMode,
} satisfies Partial<ProjectionFreshnessPolicy>;

export const PROFILE_PROJECTION_POLICY = {
  firstOpenPolicy: profileBudget.firstOpenPolicy,
  freshnessSlaMs: profileBudget.freshnessSlaMs,
  prefetchPolicy: profileBudget.prefetchPolicy,
  realtimeScope: profileBudget.realtimeScope,
  refreshMode: profileBudget.refreshMode,
} satisfies Partial<ProjectionFreshnessPolicy>;

export const VIEW_PROFILE_PROJECTION_POLICY = {
  firstOpenPolicy: viewProfileBudget.firstOpenPolicy,
  freshnessSlaMs: viewProfileBudget.freshnessSlaMs,
  prefetchPolicy: viewProfileBudget.prefetchPolicy,
  realtimeScope: viewProfileBudget.realtimeScope,
  refreshMode: viewProfileBudget.refreshMode,
} satisfies Partial<ProjectionFreshnessPolicy>;

export const NOTIFICATIONS_PROJECTION_POLICY = {
  firstOpenPolicy: notificationsBudget.firstOpenPolicy,
  freshnessSlaMs: notificationsBudget.freshnessSlaMs,
  prefetchPolicy: notificationsBudget.prefetchPolicy,
  realtimeScope: notificationsBudget.realtimeScope,
  // Request notifications can be replaced or collapsed server-side, so full refreshes are safer than deltas.
  refreshMode: notificationsBudget.refreshMode,
} satisfies Partial<ProjectionFreshnessPolicy>;

export const EVENT_DETAIL_PROJECTION_POLICY = {
  firstOpenPolicy: eventDetailBudget.firstOpenPolicy,
  freshnessSlaMs: eventDetailBudget.freshnessSlaMs,
  prefetchPolicy: eventDetailBudget.prefetchPolicy,
  realtimeScope: eventDetailBudget.realtimeScope,
  refreshMode: eventDetailBudget.refreshMode,
} satisfies Partial<ProjectionFreshnessPolicy>;

export const RELATIONSHIP_PROJECTION_POLICY = {
  firstOpenPolicy: relationshipsBudget.firstOpenPolicy,
  freshnessSlaMs: relationshipsBudget.freshnessSlaMs,
  prefetchPolicy: relationshipsBudget.prefetchPolicy,
  realtimeScope: relationshipsBudget.realtimeScope,
  refreshMode: relationshipsBudget.refreshMode,
} satisfies Partial<ProjectionFreshnessPolicy>;

export const BLOCKED_USERS_PROJECTION_POLICY = {
  firstOpenPolicy: blockedUsersBudget.firstOpenPolicy,
  freshnessSlaMs: blockedUsersBudget.freshnessSlaMs,
  prefetchPolicy: blockedUsersBudget.prefetchPolicy,
  realtimeScope: blockedUsersBudget.realtimeScope,
  refreshMode: blockedUsersBudget.refreshMode,
} satisfies Partial<ProjectionFreshnessPolicy>;
