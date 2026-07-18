describe("telemetry queue", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("bounds payload fields before sending telemetry batches", async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    const getSession = jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "token",
        },
      },
    });

    jest.doMock("../../platform/logging/logger", () => ({
      debugLog: jest.fn(),
    }));
    jest.doMock("../supabase", () => ({
      supabase: {
        auth: {
          getSession,
        },
        rpc,
      },
    }));

    const { flushTelemetryQueue, recordTelemetry } = require("./index") as typeof import("./index");
    const oversizedMeta = Object.fromEntries(
      Array.from({ length: 60 }, (_value, index) => [
        `key-${index}`,
        `${"x".repeat(140)}-${index}`,
      ]),
    );

    recordTelemetry({
      category: "api_request",
      meta: oversizedMeta,
      name: `GET /${"route/".repeat(40)}`,
      path: `/${"segment/".repeat(50)}`,
      screenKey: `viewer:${"screen-".repeat(30)}`,
      status: "rollback",
      timestamp: "2026-03-15T00:00:00.000Z",
    });

    await flushTelemetryQueue();

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);

    const payload = rpc.mock.calls[0][1].payload as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);

    const item = payload[0];
    expect(String(item.event_name || "").length).toBeLessThanOrEqual(120);
    expect(String(item.path || "").length).toBeLessThanOrEqual(240);
    expect(String(item.screen_key || "").length).toBeLessThanOrEqual(120);
    expect(Buffer.byteLength(JSON.stringify(item.meta || {}), "utf8")).toBeLessThanOrEqual(4096);
  });

  it("normalizes previously-invalid fields so all events reach the server", async () => {
    const debugLog = jest.fn();
    const rpc = jest.fn().mockResolvedValue({ error: null });
    const getSession = jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "token",
        },
      },
    });

    jest.doMock("../../platform/logging/logger", () => ({
      debugLog,
    }));
    jest.doMock("../supabase", () => ({
      supabase: {
        auth: {
          getSession,
        },
        rpc,
      },
    }));

    const { flushTelemetryQueue, recordTelemetry } = require("./index") as typeof import("./index");

    recordTelemetry({
      category: "screen",
      name: "valid-event",
      timestamp: "2026-03-15T00:00:00.000Z",
    });
    recordTelemetry({
      category: "" as unknown as import("./types").TelemetryEvent["category"],
      name: "previously-invalid-event",
      timestamp: "2026-03-15T00:00:01.000Z",
    } as unknown as import("./types").TelemetryEvent);

    await flushTelemetryQueue();

    expect(rpc).toHaveBeenCalledTimes(1);
    const payload = rpc.mock.calls[0][1].payload as Array<Record<string, unknown>>;
    // Normalization now fixes empty category to "screen", so both events are valid
    expect(payload).toHaveLength(2);
    expect(payload[0]?.event_name).toBe("valid-event");
    expect(payload[1]?.event_name).toBe("previously-invalid-event");
    expect(payload[1]?.category).toBe("screen");
  });

  it("omits duration_ms from payload when not a valid finite number", async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    const getSession = jest.fn().mockResolvedValue({
      data: { session: { access_token: "token" } },
    });

    jest.doMock("../../platform/logging/logger", () => ({ debugLog: jest.fn() }));
    jest.doMock("../supabase", () => ({
      supabase: { auth: { getSession }, rpc },
    }));

    const { flushTelemetryQueue, recordTelemetry } = require("./index") as typeof import("./index");

    recordTelemetry({
      category: "screen",
      name: "event-without-duration",
      timestamp: "2026-03-15T00:00:00.000Z",
    });
    recordTelemetry({
      category: "screen",
      durationMs: 250,
      name: "event-with-duration",
      timestamp: "2026-03-15T00:00:01.000Z",
    });
    recordTelemetry({
      category: "screen",
      durationMs: undefined,
      name: "event-undefined-duration",
      timestamp: "2026-03-15T00:00:02.000Z",
    });

    await flushTelemetryQueue();

    expect(rpc).toHaveBeenCalledTimes(1);
    const payload = rpc.mock.calls[0][1].payload as Array<Record<string, unknown>>;

    // Event without durationMs — key should be absent
    expect(Object.prototype.hasOwnProperty.call(payload[0], "duration_ms")).toBe(false);

    // Event with valid durationMs — key should be present with value
    expect(payload[1]?.duration_ms).toBe(250);

    // Event with undefined durationMs — key should be absent
    expect(Object.prototype.hasOwnProperty.call(payload[2], "duration_ms")).toBe(false);
  });

  it("isolates server-rejected telemetry payload items and keeps valid events flowing", async () => {
    const debugLog = jest.fn();
    const rpc = jest
      .fn()
      .mockImplementation(
        async (_name: string, params: { payload: Array<Record<string, unknown>> }) => {
          const eventNames = (params.payload || []).map((item) => String(item.event_name || ""));
          if (eventNames.length > 1) {
            return { error: { message: "telemetry_payload_invalid" } };
          }
          return eventNames[0] === "invalid-event"
            ? { error: { message: "telemetry_payload_invalid" } }
            : { error: null };
        },
      );
    const getSession = jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "token",
        },
      },
    });

    jest.doMock("../../platform/logging/logger", () => ({
      debugLog,
    }));
    jest.doMock("../supabase", () => ({
      supabase: {
        auth: {
          getSession,
        },
        rpc,
      },
    }));

    const { flushTelemetryQueue, recordTelemetry } = require("./index") as typeof import("./index");

    recordTelemetry({
      category: "screen",
      name: "valid-event",
      timestamp: "2026-03-15T00:00:00.000Z",
    });
    recordTelemetry({
      category: "screen",
      name: "invalid-event",
      timestamp: "2026-03-15T00:00:01.000Z",
    });

    await flushTelemetryQueue();
    await flushTelemetryQueue();

    expect(rpc).toHaveBeenCalledTimes(3);
    expect(debugLog).toHaveBeenCalledWith("TELEMETRY", "flush-drop-server-invalid", {
      dropped: 1,
      items: [
        {
          category: "screen",
          eventName: "invalid-event",
          path: null,
          screenKey: null,
          status: null,
        },
      ],
    });
  });

  it("keeps telemetry queued when the transport throws", async () => {
    const debugLog = jest.fn();
    const rpc = jest
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({ error: null });
    const getSession = jest.fn().mockResolvedValue({
      data: { session: { access_token: "token" } },
    });

    jest.doMock("../../platform/logging/logger", () => ({ debugLog }));
    jest.doMock("../supabase", () => ({
      supabase: { auth: { getSession }, rpc },
    }));

    const { flushTelemetryQueue, recordTelemetry } = require("./index") as typeof import("./index");

    recordTelemetry({
      category: "screen",
      name: "retry-after-transport-error",
      timestamp: "2026-03-15T00:00:00.000Z",
    });

    await expect(flushTelemetryQueue()).resolves.toBeUndefined();
    await expect(flushTelemetryQueue()).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(debugLog).toHaveBeenCalledWith("TELEMETRY", "flush-exception", {
      message: "network unavailable",
      retained: 1,
    });
  });
});
