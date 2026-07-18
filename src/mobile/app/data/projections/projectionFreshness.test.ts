import {
  resolveProjectionFreshnessPolicy,
  shouldShowInitialProjectionSkeleton,
} from "./policies/projectionFreshness";

describe("projection freshness policy", () => {
  it("merges defaults with partial overrides", () => {
    const resolved = resolveProjectionFreshnessPolicy({
      freshnessSlaMs: 5_000,
      prefetchPolicy: "warmup",
    });

    expect(resolved.firstOpenPolicy).toBe("last-known-content");
    expect(resolved.freshnessSlaMs).toBe(5_000);
    expect(resolved.prefetchPolicy).toBe("warmup");
    expect(resolved.refreshMode).toBe("delta");
  });

  it("shows a skeleton whenever loading starts without renderable cached content", () => {
    const skeletonPolicy = resolveProjectionFreshnessPolicy({
      firstOpenPolicy: "skeleton",
    });
    const defaultPolicy = resolveProjectionFreshnessPolicy();
    expect(
      shouldShowInitialProjectionSkeleton({
        hasCachedSnapshot: false,
        itemCount: 0,
        loading: true,
        policy: skeletonPolicy,
      }),
    ).toBe(true);
    expect(
      shouldShowInitialProjectionSkeleton({
        hasCachedSnapshot: false,
        itemCount: 0,
        loading: true,
        policy: defaultPolicy,
      }),
    ).toBe(true);
  });

  it("keeps renderable cached content visible during a background refetch", () => {
    const defaultPolicy = resolveProjectionFreshnessPolicy();
    expect(
      shouldShowInitialProjectionSkeleton({
        hasCachedSnapshot: true,
        itemCount: 0,
        loading: true,
        policy: defaultPolicy,
      }),
    ).toBe(false);
    expect(
      shouldShowInitialProjectionSkeleton({
        hasCachedSnapshot: true,
        itemCount: 1,
        loading: true,
        policy: defaultPolicy,
      }),
    ).toBe(false);
  });
});
