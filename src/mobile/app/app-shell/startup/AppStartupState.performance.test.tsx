import React from "react";
import { Text } from "react-native";
import { render, waitFor } from "@testing-library/react-native";

const mockPrimeHomeStartupSnapshotsIntoQueryCache = jest.fn();
const mockQueryClient = {
  getQueriesData: jest.fn(),
};

jest.mock("@tanstack/react-query", () => ({
  useIsRestoring: () => false,
  useQueryClient: () => mockQueryClient,
}));

jest.mock("../../features/home/public/warmup", () => ({
  primeHomeStartupSnapshotsIntoQueryCache: (...args: unknown[]) =>
    mockPrimeHomeStartupSnapshotsIntoQueryCache(...args),
}));

jest.mock("../bootstrap/appBootstrap", () => ({
  hydrateStartupCaches: jest.fn(async () => undefined),
}));

jest.mock("../../platform/observability", () => ({
  logScreenView: jest.fn(),
  startObservedTimer: jest.fn(() => jest.fn()),
}));

import { AppStartupStateProvider, useAppStartupState } from "./AppStartupState";

function StartupProbe() {
  const { queryCacheReady } = useAppStartupState();
  return <Text testID="query-cache-ready">{String(queryCacheReady)}</Text>;
}

describe("AppStartupStateProvider perceived startup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens the first-fold gate from restored Home data without awaiting snapshot IO", async () => {
    mockQueryClient.getQueriesData.mockReturnValue([
      [["screen", "home", "viewer", "scope"], { ids: ["event:1"] }],
    ]);
    mockPrimeHomeStartupSnapshotsIntoQueryCache.mockReturnValue(new Promise(() => undefined));

    const { getByTestId } = render(
      <AppStartupStateProvider>
        <StartupProbe />
      </AppStartupStateProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("query-cache-ready").props.children).toBe("true");
    });
    expect(mockPrimeHomeStartupSnapshotsIntoQueryCache).toHaveBeenCalledWith(mockQueryClient);
  });
});
