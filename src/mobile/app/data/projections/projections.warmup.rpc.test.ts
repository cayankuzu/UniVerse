import { isFunctionUnavailable } from "../../platform/api/core";
import { debugLog } from "../../platform/logging/logger";
import {
  createBackpressureWarmupBundle,
  normalizeWarmupBundle,
} from "./projections.warmup.normalize";
import { getProjectionWarmupBundle } from "./projections.warmup.rpc";
import { executeWarmupProjectionRpc } from "./projections.warmup.transport";

jest.mock("../../platform/api/core", () => ({ isFunctionUnavailable: jest.fn() }));
jest.mock("../../platform/logging/logger", () => ({ debugLog: jest.fn() }));
jest.mock("./projections.common", () => ({
  normalizeProjectionValue: (value: string) => value.trim().toLowerCase(),
}));
jest.mock("./projections.warmup.normalize", () => ({
  createBackpressureWarmupBundle: jest.fn((homeScope: string) => ({
    homeScope,
    source: "timeout-backpressure",
  })),
  HOME_WARMUP_SCOPE: "all:all:all:newest",
  normalizeWarmupBundle: jest.fn(),
}));
jest.mock("./projections.warmup.transport", () => ({
  buildWarmupRpcParams: jest.fn((value) => value),
  executeWarmupProjectionRpc: jest.fn(),
}));

const mockedExecute = executeWarmupProjectionRpc as jest.MockedFunction<
  typeof executeWarmupProjectionRpc
>;
const mockedNormalize = normalizeWarmupBundle as jest.MockedFunction<typeof normalizeWarmupBundle>;
const mockedUnavailable = isFunctionUnavailable as jest.MockedFunction<
  typeof isFunctionUnavailable
>;

describe("getProjectionWarmupBundle", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns a normalized RPC bundle with the requested home scope", async () => {
    mockedExecute.mockResolvedValue({ data: { ok: true }, error: null, timedOut: false });
    mockedNormalize.mockReturnValue({ source: "rpc" } as any);

    await expect(
      getProjectionWarmupBundle({
        home: { scope: " clubs:newest " } as any,
        viewerId: "viewer-1",
        viewerUsername: " Viewer ",
      }),
    ).resolves.toEqual({ homeScope: "clubs:newest", source: "rpc" });
  });

  it("logs actionable timeouts and applies backpressure", async () => {
    const error = { message: "timed out" } as any;
    mockedExecute.mockResolvedValue({ data: null, error, timedOut: true });
    mockedUnavailable.mockReturnValue(false);

    await expect(
      getProjectionWarmupBundle({ viewerId: "viewer-1", viewerUsername: "viewer" }),
    ).resolves.toEqual({ homeScope: "all:all:all:newest", source: "timeout-backpressure" });
    expect(debugLog).toHaveBeenCalledWith(
      "PROJECTIONS",
      "warmup-rpc-timeout",
      expect.objectContaining({ message: "timed out" }),
    );
    expect(createBackpressureWarmupBundle).toHaveBeenCalledWith("all:all:all:newest");
  });

  it("silently applies backpressure for unavailable or invalid RPC responses", async () => {
    mockedExecute.mockResolvedValueOnce({
      data: null,
      error: { message: "missing" } as any,
      timedOut: false,
    });
    mockedUnavailable.mockReturnValue(true);
    await getProjectionWarmupBundle({ viewerId: "viewer-1", viewerUsername: "viewer" });
    expect(debugLog).not.toHaveBeenCalled();

    mockedExecute.mockResolvedValueOnce({ data: {}, error: null, timedOut: false });
    mockedNormalize.mockReturnValue(null);
    await getProjectionWarmupBundle({ viewerId: "viewer-1", viewerUsername: "viewer" });
    expect(createBackpressureWarmupBundle).toHaveBeenCalledTimes(2);
  });
});
