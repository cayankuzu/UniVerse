import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGateway, readGatewayConfig, type GatewayDependencies } from "../src/gateway";

const SUBJECT = "11111111-1111-4111-8111-111111111111";

type TestEnv = Env & {
  CF_VERSION_METADATA: WorkerVersionMetadata;
};

function rateLimiter(success = true, calls: string[] = []): RateLimit {
  return {
    async limit({ key }) {
      calls.push(key);
      return { success };
    },
  };
}

function buildEnv(overrides: Partial<TestEnv> = {}): TestEnv {
  return {
    ALLOWED_ORIGINS: "https://app.example.com",
    AUTH_RATE_LIMITER: rateLimiter(),
    CF_VERSION_METADATA: {
      id: "worker-version-123",
      tag: "sha-test123",
      timestamp: "2026-08-30T12:00:00.000Z",
    },
    ENVIRONMENT: "development",
    JWT_AUDIENCE: "authenticated",
    JWT_ISSUER: "https://project.supabase.co/auth/v1",
    ORIGIN_BASE_URL: "https://project.supabase.co/functions/v1/server/make-server-e3557d40",
    ORIGIN_HMAC_SECRET: "origin-secret-that-is-at-least-32-bytes",
    RATE_LIMIT_SALT: "rate-limit-salt-that-is-at-least-32-bytes",
    REPORT_RATE_LIMITER: rateLimiter(),
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
    SUPABASE_URL: "https://project.supabase.co",
    UPLOAD_RATE_LIMITER: rateLimiter(),
    UPSTREAM_TIMEOUT_MS: "1000",
    ...overrides,
  };
}

function registerDirectBody(extra: Record<string, unknown> = {}) {
  return {
    accountType: "student",
    categories: [],
    email: "ada@example.com",
    existingUserId: SUBJECT,
    isPrivate: false,
    registrationNonce: "nonce-that-is-long-enough",
    university: "Example University",
    username: "ada_test",
    ...extra,
  };
}

function reportBody() {
  return {
    reason: "spam",
    targetId: "22222222-2222-4222-8222-222222222222",
    targetType: "event",
  };
}

function dependencies(fetcher: typeof fetch): Partial<GatewayDependencies> {
  return {
    fetcher,
    now: () => 1_788_080_000_000,
    randomUuid: () => "33333333-3333-4333-8333-333333333333",
    verifyJwt: vi.fn(async () => ({ subject: SUBJECT })),
  };
}

describe("selective edge gateway", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies signed health, preserves the exact origin contract, and publishes trusted version metadata", async () => {
    const originBody = JSON.stringify({
      authRecoveryEndpointsEnabled: false,
      compatRoutesEnabled: false,
      legacyEdgeReadsEnabled: false,
      mediaScannerConfigured: true,
      status: "ok",
    });
    let forwardedUrl = "";
    let forwardedHeaders = new Headers();
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      forwardedUrl = String(input);
      forwardedHeaders = new Headers(init?.headers);
      return new Response(originBody, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-request-id": "origin-health-1",
          "x-universe-worker-version-id": "origin-controlled-id",
          "x-universe-worker-version-tag": "origin-controlled-tag",
        },
      });
    });
    const gateway = createGateway(dependencies(fetcher));
    const response = await gateway.fetch(
      new Request("https://edge.example.com/health", {
        headers: { "x-request-id": "request-health-1" },
      }),
      buildEnv(),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(originBody);
    expect(forwardedUrl).toBe(
      "https://project.supabase.co/functions/v1/server/make-server-e3557d40/health",
    );
    expect(forwardedHeaders.get("x-universe-edge-signature-version")).toBe("2");
    expect(forwardedHeaders.get("x-universe-edge-signature")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(forwardedHeaders.get("x-universe-edge-canonical-path")).toBe("/health");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-request-id")).toBe("request-health-1");
    expect(response.headers.get("x-origin-request-id")).toBe("origin-health-1");
    expect(response.headers.get("x-universe-worker-version-id")).toBe("worker-version-123");
    expect(response.headers.get("x-universe-worker-version-tag")).toBe("sha-test123");
    const exposedResponse = `${originBody}\n${JSON.stringify([...response.headers])}`;
    expect(exposedResponse).not.toContain("origin-secret-that-is-at-least-32-bytes");
    expect(exposedResponse).not.toContain("rate-limit-salt-that-is-at-least-32-bytes");
    expect(exposedResponse).not.toContain("sb_publishable_abcdefghijklmnopqrstuvwxyz");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails closed when origin health adds fields outside the secret-free contract", async () => {
    const fetcher: typeof fetch = vi.fn(async () =>
      Response.json({
        authRecoveryEndpointsEnabled: false,
        compatRoutesEnabled: false,
        legacyEdgeReadsEnabled: false,
        mediaScannerConfigured: true,
        originSecret: "must-not-pass",
        status: "ok",
      }),
    );
    const response = await createGateway(dependencies(fetcher)).fetch(
      new Request("https://edge.example.com/health"),
      buildEnv(),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "invalid_origin_health" });
  });

  it("rejects streamed oversized health responses without awaiting stalled cancellation", async () => {
    let cancelCalled = false;
    const fetcher: typeof fetch = vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            cancel() {
              cancelCalled = true;
              return new Promise<void>(() => undefined);
            },
            start(controller) {
              controller.enqueue(new Uint8Array(4097));
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const outcome = await Promise.race([
      createGateway(dependencies(fetcher)).fetch(
        new Request("https://edge.example.com/health"),
        buildEnv(),
      ),
      new Promise<"timeout">((resolve) => {
        timeoutId = setTimeout(() => resolve("timeout"), 500);
      }),
    ]);
    if (timeoutId) clearTimeout(timeoutId);
    if (outcome === "timeout") throw new Error("oversized health response handling timed out");
    expect(outcome.status).toBe(503);
    expect(await outcome.json()).toMatchObject({ code: "invalid_origin_health" });
    expect(cancelCalled).toBe(true);
  });

  it("returns 404 for every route outside the explicit matrix", async () => {
    const gateway = createGateway();
    const response = await gateway.fetch(
      new Request("https://edge.example.com/events/private-feed?viewer=secret"),
      buildEnv(),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "route_not_found" });
  });

  it("returns 405 and an exact Allow header for a matched path", async () => {
    const gateway = createGateway();
    const response = await gateway.fetch(
      new Request("https://edge.example.com/reports", { method: "DELETE" }),
      buildEnv(),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("accepts exact CORS preflight origins and rejects all others", async () => {
    const gateway = createGateway();
    const accepted = await gateway.fetch(
      new Request("https://edge.example.com/reports", {
        headers: {
          "access-control-request-method": "POST",
          origin: "https://app.example.com",
        },
        method: "OPTIONS",
      }),
      buildEnv(),
    );
    expect(accepted.status).toBe(204);
    expect(accepted.headers.get("access-control-allow-origin")).toBe("https://app.example.com");

    const rejected = await gateway.fetch(
      new Request("https://edge.example.com/reports", {
        headers: {
          "access-control-request-method": "POST",
          origin: "https://evil.example.com",
        },
        method: "OPTIONS",
      }),
      buildEnv(),
    );
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("permits native requests without an Origin header", async () => {
    const fetcher: typeof fetch = vi.fn(async () => Response.json({ available: true }));
    const gateway = createGateway(dependencies(fetcher));
    const response = await gateway.fetch(
      new Request("https://edge.example.com/auth/check-email?email=ada%40example.com"),
      buildEnv(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects unexpected query parameters before contacting origin", async () => {
    const fetcher: typeof fetch = vi.fn(async () => Response.json({ available: true }));
    const gateway = createGateway(dependencies(fetcher));
    const response = await gateway.fetch(
      new Request("https://edge.example.com/auth/check-email?email=ada%40example.com&role=admin"),
      buildEnv(),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_query" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("enforces bounded JSON bodies and media types", async () => {
    const gateway = createGateway();
    const tooLarge = await gateway.fetch(
      new Request("https://edge.example.com/reports", {
        body: JSON.stringify(reportBody()),
        headers: {
          authorization: "Bearer valid-token",
          "content-length": "5000",
          "content-type": "application/json",
        },
        method: "POST",
      }),
      buildEnv(),
    );
    expect(tooLarge.status).toBe(413);

    const streamedTooLarge = await gateway.fetch(
      new Request("https://edge.example.com/reports", {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(4097));
            controller.close();
          },
        }),
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        method: "POST",
      }),
      buildEnv(),
    );
    expect(streamedTooLarge.status).toBe(413);

    const wrongType = await gateway.fetch(
      new Request("https://edge.example.com/auth/register-direct", {
        body: JSON.stringify(registerDirectBody()),
        headers: { "content-type": "text/plain" },
        method: "POST",
      }),
      buildEnv(),
    );
    expect(wrongType.status).toBe(415);
  });

  it("normalizes schemas and removes unknown mass-assignment fields", async () => {
    let forwardedBody = "";
    const fetcher: typeof fetch = vi.fn(async (_input, init) => {
      forwardedBody = new TextDecoder().decode(init?.body as ArrayBuffer);
      return Response.json({ success: true });
    });
    const gateway = createGateway(dependencies(fetcher));
    const response = await gateway.fetch(
      new Request("https://edge.example.com/auth/register-direct", {
        body: JSON.stringify(registerDirectBody({ admin: true, serviceRole: true })),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      buildEnv(),
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(forwardedBody)).toEqual(registerDirectBody());
  });

  it("requires verified user auth for protected routes", async () => {
    const fetcher: typeof fetch = vi.fn(async () => Response.json({ success: true }));
    const gateway = createGateway(dependencies(fetcher));
    const response = await gateway.fetch(
      new Request("https://edge.example.com/reports", {
        body: JSON.stringify(reportBody()),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      buildEnv(),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "authentication_required" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("forwards a verified bearer token and signed origin identity", async () => {
    let forwardedHeaders = new Headers();
    const fetcher: typeof fetch = vi.fn(async (_input, init) => {
      forwardedHeaders = new Headers(init?.headers);
      return Response.json({ success: true }, { headers: { "x-request-id": "origin-1" } });
    });
    const gateway = createGateway(dependencies(fetcher));
    const response = await gateway.fetch(
      new Request("https://edge.example.com/reports", {
        body: JSON.stringify(reportBody()),
        headers: {
          authorization: "Bearer user-jwt",
          "cf-connecting-ip": "203.0.113.42",
          "content-type": "application/json",
          "idempotency-key": "report-request-123",
          "x-request-id": "request-report-1",
        },
        method: "POST",
      }),
      buildEnv(),
    );
    expect(response.status).toBe(200);
    expect(forwardedHeaders.get("authorization")).toBe("Bearer user-jwt");
    expect(forwardedHeaders.get("apikey")).toBe("sb_publishable_abcdefghijklmnopqrstuvwxyz");
    expect(forwardedHeaders.get("idempotency-key")).toBe("report-request-123");
    expect(forwardedHeaders.get("x-universe-edge-body-sha256")).toMatch(/^[a-f0-9]{64}$/);
    expect(forwardedHeaders.get("x-universe-edge-signature")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(forwardedHeaders.get("x-universe-edge-signature-version")).toBe("2");
    expect(forwardedHeaders.get("x-universe-edge-canonical-path")).toBe("/reports");
    expect(forwardedHeaders.get("x-universe-edge-client-network-key")).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(forwardedHeaders.get("x-universe-edge-client-network-key")).not.toContain(
      "203.0.113.42",
    );
    expect(response.headers.get("x-origin-request-id")).toBe("origin-1");
  });

  it("does not forward an attacker-provided bearer token on anonymous routes", async () => {
    let forwardedHeaders = new Headers();
    const fetcher: typeof fetch = vi.fn(async (_input, init) => {
      forwardedHeaders = new Headers(init?.headers);
      return Response.json({ available: true });
    });
    const gateway = createGateway(dependencies(fetcher));
    const response = await gateway.fetch(
      new Request("https://edge.example.com/auth/check-email?email=ada%40example.com", {
        headers: { authorization: "Bearer attacker-token" },
      }),
      buildEnv(),
    );
    expect(response.status).toBe(200);
    expect(forwardedHeaders.get("authorization")).toBeNull();
  });

  it("rejects exhausted network budgets before parsing bodies or verifying auth", async () => {
    const fetcher: typeof fetch = vi.fn(async () => Response.json({ success: true }));
    const verifyJwt = vi.fn(async () => ({ subject: SUBJECT }));
    const gateway = createGateway({ ...dependencies(fetcher), verifyJwt });
    const response = await gateway.fetch(
      new Request("https://edge.example.com/reports", {
        body: "not-json",
        headers: { authorization: "Bearer user-jwt", "content-type": "text/plain" },
        method: "POST",
      }),
      buildEnv({ REPORT_RATE_LIMITER: rateLimiter(false) }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(verifyJwt).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed when a route's configured rate-limit binding is unavailable", async () => {
    const fetcher: typeof fetch = vi.fn(async () => Response.json({ success: true }));
    const response = await createGateway(dependencies(fetcher)).fetch(
      new Request("https://edge.example.com/reports", {
        body: JSON.stringify(reportBody()),
        headers: { authorization: "Bearer user-jwt", "content-type": "application/json" },
        method: "POST",
      }),
      buildEnv({ REPORT_RATE_LIMITER: undefined }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "configuration_error" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("applies a separate actor budget after successful authentication", async () => {
    const fetcher: typeof fetch = vi.fn(async () => Response.json({ success: true }));
    const verifyJwt = vi.fn(async () => ({ subject: SUBJECT }));
    let limitCalls = 0;
    const limiter: RateLimit = {
      async limit() {
        limitCalls += 1;
        return { success: limitCalls === 1 };
      },
    };
    const response = await createGateway({ ...dependencies(fetcher), verifyJwt }).fetch(
      new Request("https://edge.example.com/reports", {
        body: JSON.stringify(reportBody()),
        headers: { authorization: "Bearer user-jwt", "content-type": "application/json" },
        method: "POST",
      }),
      buildEnv({ REPORT_RATE_LIMITER: limiter }),
    );
    expect(response.status).toBe(429);
    expect(limitCalls).toBe(2);
    expect(verifyJwt).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses independent opaque keys for network and anonymous actor budgets", async () => {
    const rateLimitCalls: string[] = [];
    const fetcher: typeof fetch = vi.fn(async () => Response.json({ available: true }));
    const gateway = createGateway(dependencies(fetcher));
    const env = buildEnv({ AUTH_RATE_LIMITER: rateLimiter(true, rateLimitCalls) });
    for (const [network, email] of [
      ["203.0.113.10", "ada@example.com"],
      ["203.0.113.10", "grace@example.com"],
      ["203.0.113.11", "ada@example.com"],
    ] as const) {
      const response = await gateway.fetch(
        new Request(
          `https://edge.example.com/auth/check-email?email=${encodeURIComponent(email)}`,
          {
            headers: { "cf-connecting-ip": network },
          },
        ),
        env,
      );
      expect(response.status).toBe(200);
    }

    expect(rateLimitCalls).toHaveLength(6);
    expect(rateLimitCalls[0]).toBe(rateLimitCalls[2]);
    expect(rateLimitCalls[0]).not.toBe(rateLimitCalls[4]);
    expect(rateLimitCalls[1]).not.toBe(rateLimitCalls[3]);
    expect(rateLimitCalls[1]).toBe(rateLimitCalls[5]);
    for (const key of rateLimitCalls) {
      expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(key).not.toMatch(/203\.0\.113|example\.com/);
    }
  });

  it("never retries mutations but retries a bounded allowlisted GET once", async () => {
    const mutationFetcher: typeof fetch = vi.fn(async () =>
      Response.json({ error: "unavailable" }, { status: 503 }),
    );
    const mutationGateway = createGateway(dependencies(mutationFetcher));
    const mutationResponse = await mutationGateway.fetch(
      new Request("https://edge.example.com/reports", {
        body: JSON.stringify(reportBody()),
        headers: { authorization: "Bearer user-jwt", "content-type": "application/json" },
        method: "POST",
      }),
      buildEnv(),
    );
    expect(mutationResponse.status).toBe(503);
    expect(mutationFetcher).toHaveBeenCalledTimes(1);

    let attempt = 0;
    const retryHeaders: Headers[] = [];
    const getFetcher: typeof fetch = vi.fn(async (_input, init) => {
      retryHeaders.push(new Headers(init?.headers));
      attempt += 1;
      return attempt === 1
        ? Response.json({ error: "unavailable" }, { status: 503 })
        : Response.json({ available: true });
    });
    const retryNonces = [
      "55555555-5555-4555-8555-555555555555",
      "66666666-6666-4666-8666-666666666666",
    ];
    const getGateway = createGateway({
      ...dependencies(getFetcher),
      randomUuid: () => retryNonces.shift() || "77777777-7777-4777-8777-777777777777",
    });
    const getResponse = await getGateway.fetch(
      new Request("https://edge.example.com/auth/check-email?email=ada%40example.com", {
        headers: {
          "cf-connecting-ip": "203.0.113.42",
          "x-request-id": "request-check-email-1",
        },
      }),
      buildEnv(),
    );
    expect(getResponse.status).toBe(200);
    expect(getFetcher).toHaveBeenCalledTimes(2);
    expect(retryHeaders).toHaveLength(2);
    const firstRetryHeaders = retryHeaders[0]!;
    const secondRetryHeaders = retryHeaders[1]!;
    expect(firstRetryHeaders.get("x-universe-edge-nonce")).not.toBe(
      secondRetryHeaders.get("x-universe-edge-nonce"),
    );
    expect(firstRetryHeaders.get("x-universe-edge-signature")).not.toBe(
      secondRetryHeaders.get("x-universe-edge-signature"),
    );
    expect(firstRetryHeaders.get("x-universe-edge-client-network-key")).toBe(
      secondRetryHeaders.get("x-universe-edge-client-network-key"),
    );
  });

  it("keeps the upstream timeout active while consuming the response body", async () => {
    const fetcher: typeof fetch = vi.fn(async (_input, init) => {
      const signal = init?.signal;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            const abort = () =>
              controller.error(signal?.reason ?? new DOMException("Aborted", "AbortError"));
            if (signal?.aborted) abort();
            else signal?.addEventListener("abort", abort, { once: true });
          },
        }),
        { headers: { "content-type": "application/json" } },
      );
    });
    const response = await createGateway(dependencies(fetcher)).fetch(
      new Request("https://edge.example.com/reports", {
        body: JSON.stringify(reportBody()),
        headers: { authorization: "Bearer user-jwt", "content-type": "application/json" },
        method: "POST",
      }),
      buildEnv({ UPSTREAM_TIMEOUT_MS: "1000" }),
    );
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: "origin_timeout" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects streamed origin responses above the global response budget", async () => {
    const fetcher: typeof fetch = vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(512 * 1024 + 1));
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );
    const response = await createGateway(dependencies(fetcher)).fetch(
      new Request("https://edge.example.com/reports", {
        body: JSON.stringify(reportBody()),
        headers: { authorization: "Bearer user-jwt", "content-type": "application/json" },
        method: "POST",
      }),
      buildEnv(),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "origin_response_too_large" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("strips origin cookies and overwrites every cache policy", async () => {
    const fetcher: typeof fetch = vi.fn(async () =>
      Response.json(
        { success: true },
        {
          headers: {
            "cache-control": "public, max-age=86400",
            "set-cookie": "session=secret",
          },
        },
      ),
    );
    const gateway = createGateway(dependencies(fetcher));
    const response = await gateway.fetch(
      new Request("https://edge.example.com/auth/register-direct", {
        body: JSON.stringify(registerDirectBody()),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      buildEnv(),
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it("fails closed for placeholder non-production origins and weak secrets", () => {
    expect(() =>
      readGatewayConfig(
        buildEnv({
          ENVIRONMENT: "development",
          JWT_ISSUER: "https://development-project-ref.invalid/auth/v1",
          ORIGIN_BASE_URL:
            "https://development-project-ref.invalid/functions/v1/server/make-server-e3557d40",
          SUPABASE_URL: "https://development-project-ref.invalid",
        }),
      ),
    ).toThrow();
    expect(() =>
      readGatewayConfig(
        buildEnv({
          ENVIRONMENT: "preview",
          JWT_ISSUER: "https://preview-project-ref.invalid/auth/v1",
          ORIGIN_BASE_URL:
            "https://preview-project-ref.invalid/functions/v1/server/make-server-e3557d40",
          SUPABASE_URL: "https://preview-project-ref.invalid",
        }),
      ),
    ).toThrow();
    expect(() => readGatewayConfig(buildEnv({ ORIGIN_HMAC_SECRET: "too-short" }))).toThrow();
  });

  it("requires canonical Supabase and exact origin function paths", () => {
    for (const overrides of [
      { SUPABASE_URL: "https://project.supabase.co/other" },
      {
        ORIGIN_BASE_URL:
          "https://project.supabase.co/functions/v1/server/make-server-e3557d40?redirect=true",
      },
      { ORIGIN_BASE_URL: "https://project.supabase.co/functions/v1/server/other" },
    ]) {
      expect(() => readGatewayConfig(buildEnv(overrides))).toThrow();
    }
    expect(
      readGatewayConfig(
        buildEnv({ ALLOWED_ORIGINS: "https://APP.EXAMPLE.TEST:443/" }),
      ).allowedOrigins.has("https://app.example.test"),
    ).toBe(true);
  });

  it("replaces malformed request IDs instead of reflecting them", async () => {
    const fetcher: typeof fetch = vi.fn(async () =>
      Response.json({
        authRecoveryEndpointsEnabled: false,
        compatRoutesEnabled: false,
        legacyEdgeReadsEnabled: false,
        mediaScannerConfigured: false,
        status: "ok",
      }),
    );
    const gateway = createGateway({
      ...dependencies(fetcher),
      randomUuid: () => "44444444-4444-4444-8444-444444444444",
    });
    const response = await gateway.fetch(
      new Request("https://edge.example.com/health", {
        headers: { "x-request-id": "bad id forged" },
      }),
      buildEnv(),
    );
    expect(response.headers.get("x-request-id")).toBe("44444444-4444-4444-8444-444444444444");
  });
});
