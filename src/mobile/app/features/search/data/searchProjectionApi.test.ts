// Keep the real runtime config (APP_ENV, env readers) so the public-env contract still
// resolves; only the projection-search flag is forced on for this suite.
jest.mock("../../../platform/config/runtime", () => {
  const actual = jest.requireActual("../../../platform/config/runtime");
  return {
    ...actual,
    RUNTIME_FLAGS: { ...actual.RUNTIME_FLAGS, useProjectionSearch: true },
  };
});

jest.mock("../../../data/projections/projections.api.helpers", () => ({
  shouldFallbackToLegacy: jest.fn(() => false),
}));

jest.mock("./searchProjectionFallback", () => ({
  buildSearchFallbackEnvelope: jest.fn(),
  trySearchProjectionEnvelope: jest.fn(),
}));

import { getSearchResults } from "./searchProjectionApi";

const { buildSearchFallbackEnvelope, trySearchProjectionEnvelope } = jest.requireMock(
  "./searchProjectionFallback",
) as {
  buildSearchFallbackEnvelope: jest.Mock;
  trySearchProjectionEnvelope: jest.Mock;
};

describe("getSearchResults", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("recovers from projection timeouts with SQL/table fallback even when legacy edge reads are disabled", async () => {
    const fallbackEnvelope = {
      deletedIds: [],
      deltaToken: "2026-03-19T12:00:00.000Z",
      items: [{ id: "event-fallback" }],
      nextCursor: null,
      serverTime: "2026-03-19T12:00:00.000Z",
      updatedItems: [],
    };
    trySearchProjectionEnvelope.mockResolvedValue(null);
    buildSearchFallbackEnvelope.mockResolvedValue(fallbackEnvelope);

    await expect(
      getSearchResults({
        kind: "events",
        limit: 20,
        queryText: "fallback",
      } as any),
    ).resolves.toEqual(fallbackEnvelope);

    expect(buildSearchFallbackEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "events",
        limit: 20,
      }),
      "fallback",
      expect.objectContaining({
        allowLegacySearchApi: false,
        skipSqlSource: true,
      }),
    );
  });
});
