import { QueryClient } from "@tanstack/react-query";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { seedProfileBootstrapCache, shouldBootstrapProfileScreen } from "./profileBootstrapCache";

describe("shouldBootstrapProfileScreen", () => {
  it("bootstraps when the overview seed is missing", () => {
    expect(
      shouldBootstrapProfileScreen({
        bootstrapIdentity: "viewer:cyn",
        bootstrappedIdentity: "",
        enabled: true,
        hasContentSeed: false,
        hasOverviewSeed: false,
        username: "cyn",
      }),
    ).toBe(true);
  });

  it("bootstraps when overview is cached but content seed is missing", () => {
    expect(
      shouldBootstrapProfileScreen({
        bootstrapIdentity: "viewer:cyn",
        bootstrappedIdentity: "",
        enabled: true,
        hasContentSeed: false,
        hasOverviewSeed: true,
        username: "cyn",
      }),
    ).toBe(true);
  });

  it("skips bootstrap when both overview and content seeds already exist", () => {
    expect(
      shouldBootstrapProfileScreen({
        bootstrapIdentity: "viewer:cyn",
        bootstrappedIdentity: "",
        enabled: true,
        hasContentSeed: true,
        hasOverviewSeed: true,
        username: "cyn",
      }),
    ).toBe(false);
  });
});

describe("seedProfileBootstrapCache", () => {
  it("clears cached content when the bootstrap overview denies content access", () => {
    const queryClient = new QueryClient();
    const contentKey = projectionKeys.profileContent("cyn", "events", "viewer-1");
    const overviewKey = projectionKeys.profileOverview("cyn", "viewer-1");

    queryClient.setQueryData(contentKey, {
      ids: ["event-1"],
      touchedAt: Date.now(),
    });

    seedProfileBootstrapCache({
      contentKey,
      overviewKey,
      queryClient,
      result: {
        content: {
          items: [{ id: "event-1" }],
          nextCursor: null,
          serverTime: "2026-01-01T00:00:00.000Z",
        },
        overview: {
          capabilities: {
            canViewContent: false,
          },
          followStatus: "none",
          id: "cyn",
          profile: {
            eventsCount: 2,
          },
          username: "cyn",
        },
      },
      tab: "events",
    });

    expect(queryClient.getQueryData(contentKey)).toBeUndefined();
    expect(queryClient.getQueryData(overviewKey)).toEqual(
      expect.objectContaining({
        capabilities: expect.objectContaining({
          canViewContent: false,
        }),
      }),
    );
  });
});
