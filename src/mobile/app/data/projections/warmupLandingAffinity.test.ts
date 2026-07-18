import {
  createEmptyLandingAffinity,
  parseLandingAffinity,
  rankWarmupLandingSurfaces,
  recordLandingAffinityVisit,
} from "./warmupLandingAffinity";

describe("warmupLandingAffinity", () => {
  it("ranks the habitual surface for the current part of day first", () => {
    const morning = new Date(2026, 6, 19, 9, 0, 0);
    const evening = new Date(2026, 6, 19, 20, 0, 0);
    let affinity = createEmptyLandingAffinity();
    affinity = recordLandingAffinityVisit(affinity, "search", morning);
    affinity = recordLandingAffinityVisit(affinity, "search", morning);
    affinity = recordLandingAffinityVisit(affinity, "profile", evening);
    affinity = recordLandingAffinityVisit(affinity, "profile", evening);
    affinity = recordLandingAffinityVisit(affinity, "profile", evening);

    expect(rankWarmupLandingSurfaces(affinity, morning)[0]).toBe("search");
    expect(rankWarmupLandingSurfaces(affinity, evening)[0]).toBe("profile");
  });

  it("sanitizes persisted scores and ignores unknown surfaces", () => {
    const parsed = parseLandingAffinity(
      JSON.stringify({
        dayPartScores: {
          morning: { notifications: -5, profile: 8, search: 1_000 },
        },
        lastSurface: "unknown",
        scores: { notifications: -2, profile: "4", search: 1_000 },
        updatedAt: "invalid",
      }),
    );

    expect(parsed).toMatchObject({
      lastSurface: null,
      scores: { notifications: 0, profile: 4, search: 100 },
    });
    expect(parsed?.dayPartScores.morning).toEqual({
      notifications: 0,
      profile: 8,
      search: 100,
    });
  });

  it("uses a deterministic fallback before affinity exists", () => {
    expect(rankWarmupLandingSurfaces(null)).toEqual(["search", "profile", "notifications"]);
  });
});
