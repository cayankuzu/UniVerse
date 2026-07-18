import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearPersistedWarmupPreferences,
  getCachedWarmupPreferences,
  loadPersistedWarmupPreferences,
  persistWarmupHomeScope,
  persistWarmupLandingVisit,
  persistWarmupProfileTab,
  persistWarmupSearchScope,
} from "./warmupPreferences";

describe("warmupPreferences", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearPersistedWarmupPreferences();
  });

  it("persists home, profile, and search warmup scopes for repeat launches", async () => {
    await persistWarmupHomeScope("Viewer-1", {
      entityFilter: "clubs",
      scope: "following:events:clubs:oldest",
      sortOption: "oldest",
      sourceFilter: "following",
      typeFilter: "events",
    });
    await persistWarmupLandingVisit("Viewer-1", "profile");
    await persistWarmupProfileTab("Viewer-1", "events");
    await persistWarmupSearchScope("Viewer-1", {
      categoryFilter: "muzik",
      feeFilter: "free",
      kind: "events",
      queryText: "festival",
      scope: "events:festival:muzik:free",
      sortMode: "date_asc",
      universityFilter: "odtu",
    });

    expect(getCachedWarmupPreferences("viewer-1")).toMatchObject({
      landingAffinity: {
        lastSurface: "profile",
        scores: { profile: 1 },
      },
      lastHomeScope: {
        entityFilter: "clubs",
        scope: "following:events:clubs:oldest",
        sortOption: "oldest",
        sourceFilter: "following",
        typeFilter: "events",
      },
      lastProfileTab: "events",
      lastSearchScope: {
        categoryFilter: "muzik",
        feeFilter: "free",
        kind: "events",
        queryText: "festival",
        scope: "events:festival:muzik:free",
        sortMode: "date_asc",
        universityFilter: "odtu",
      },
    });

    const loaded = await loadPersistedWarmupPreferences("VIEWER-1");
    expect(loaded).toMatchObject({
      landingAffinity: {
        lastSurface: "profile",
        scores: { profile: 1 },
      },
      lastHomeScope: {
        entityFilter: "clubs",
        scope: "following:events:clubs:oldest",
        sortOption: "oldest",
        sourceFilter: "following",
        typeFilter: "events",
      },
      lastProfileTab: "events",
      lastSearchScope: {
        categoryFilter: "muzik",
        feeFilter: "free",
        kind: "events",
        queryText: "festival",
        scope: "events:festival:muzik:free",
        sortMode: "date_asc",
        universityFilter: "odtu",
      },
    });
  });

  it("normalizes malformed home scope payloads and clears viewer warmup keys", async () => {
    await AsyncStorage.setItem(
      "warmup:last-home-scope:v1:viewer-1",
      JSON.stringify({
        entityFilter: "unknown",
        sortOption: "future",
        sourceFilter: "invalid",
        typeFilter: "broken",
      }),
    );

    const loaded = await loadPersistedWarmupPreferences("viewer-1");
    expect(loaded.lastHomeScope).toMatchObject({
      entityFilter: "all",
      scope: "all:all:all:newest",
      sortOption: "newest",
      sourceFilter: "all",
      typeFilter: "all",
    });

    await clearPersistedWarmupPreferences("viewer-1");

    expect(await AsyncStorage.getItem("warmup:last-home-scope:v1:viewer-1")).toBeNull();
    expect(await AsyncStorage.getItem("warmup:landing-affinity:v1:viewer-1")).toBeNull();
    expect(getCachedWarmupPreferences("viewer-1").lastHomeScope).toBeNull();
  });

  it("deduplicates concurrent preference reads and serializes affinity writes", async () => {
    const multiGetSpy = jest.spyOn(AsyncStorage, "multiGet");
    multiGetSpy.mockClear();

    await Promise.all([
      loadPersistedWarmupPreferences("viewer-2"),
      loadPersistedWarmupPreferences("VIEWER-2"),
    ]);
    expect(multiGetSpy).toHaveBeenCalledTimes(1);

    await Promise.all([
      persistWarmupLandingVisit("viewer-2", "search"),
      persistWarmupLandingVisit("viewer-2", "profile"),
    ]);
    expect(getCachedWarmupPreferences("viewer-2").landingAffinity).toMatchObject({
      lastSurface: "profile",
      scores: { profile: 1, search: 1 },
    });

    multiGetSpy.mockRestore();
  });
});
