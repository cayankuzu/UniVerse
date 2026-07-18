import { QueryClient } from "@tanstack/react-query";
import { logProjectionMetric } from "../../platform/observability";
import {
  applyInvalidationGuard,
  attachQueryInvalidationGuard,
  shouldDisableImmediateInvalidation,
} from "./guards";

jest.mock("../../platform/observability", () => ({
  logProjectionMetric: jest.fn(),
}));

describe("query invalidation guards", () => {
  it("detects blocked broad invalidation prefixes", () => {
    expect(shouldDisableImmediateInvalidation(["events", "feed", "viewer"])).toBe(true);
    expect(shouldDisableImmediateInvalidation(["screen", "home", "viewer"])).toBe(true);
    expect(shouldDisableImmediateInvalidation(["screen", "profile-overview", "viewer"])).toBe(true);
    expect(shouldDisableImmediateInvalidation(["badge", "notifications", "viewer"])).toBe(false);
  });

  it("converts blocked invalidations into no-refetch invalidations", () => {
    expect(
      applyInvalidationGuard({
        queryKey: ["profile", "albums", "viewer"],
      }),
    ).toMatchObject({
      queryKey: ["profile", "albums", "viewer"],
      refetchType: "none",
    });
    expect(
      applyInvalidationGuard({
        queryKey: ["screen", "home", "viewer"],
      }),
    ).toMatchObject({
      queryKey: ["screen", "home", "viewer"],
      refetchType: "none",
    });
    expect(
      applyInvalidationGuard({
        queryKey: ["badge", "notifications", "viewer"],
      }),
    ).toMatchObject({
      queryKey: ["badge", "notifications", "viewer"],
    });
  });

  it("logs and blocks immediate refetch for guarded invalidations", async () => {
    const queryClient = attachQueryInvalidationGuard(new QueryClient());

    await queryClient.invalidateQueries({
      queryKey: ["screen", "search", "albums", "viewer", "{}"],
      refetchType: "active",
    });

    expect(logProjectionMetric).toHaveBeenCalledWith({
      meta: {
        action: "invalidateQueries",
        reason: "guarded-projection-refetch-blocked",
        queryKey: ["screen", "search", "albums", "viewer", "{}"],
      },
      name: "broad_refetch_count",
      screenKey: '["screen","search","albums","viewer","{}"]',
      status: "rollback",
    });
  });

  it("logs scoped projection resets separately from rollback refetch guards", async () => {
    const queryClient = attachQueryInvalidationGuard(new QueryClient());

    queryClient.removeQueries({
      queryKey: ["screen", "profile-overview", "viewer"],
      exact: false,
    });

    expect(logProjectionMetric).toHaveBeenCalledWith({
      meta: {
        action: "removeQueries",
        reason: "guarded-projection-scope-reset",
        queryKey: ["screen", "profile-overview", "viewer"],
      },
      name: "projection_scope_reset",
      screenKey: '["screen","profile-overview","viewer"]',
      status: "ok",
    });
  });
});
