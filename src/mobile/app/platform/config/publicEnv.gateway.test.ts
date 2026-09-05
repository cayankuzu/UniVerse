import { URL as NodeUrl } from "node:url";

import {
  resolveEnvironmentScopedPublicValue,
  validateOptionalGatewayUrl,
  validateSupabaseFunctionsBaseUrl,
  validateSupabaseProjectUrl,
} from "./publicEnv";

describe("optional Cloudflare gateway public environment", () => {
  const originalUrlDescriptor = Object.getOwnPropertyDescriptor(globalThis, "URL");

  beforeAll(() => {
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: NodeUrl,
      writable: true,
    });
  });

  afterAll(() => {
    if (originalUrlDescriptor) Object.defineProperty(globalThis, "URL", originalUrlDescriptor);
  });

  it("keeps an empty gateway disabled and normalizes HTTPS origins", () => {
    expect(validateOptionalGatewayUrl("GATEWAY", "")).toBe("");
    expect(validateOptionalGatewayUrl("GATEWAY", " https://api.example.test/ ")).toBe(
      "https://api.example.test",
    );
  });

  it("allows HTTP only for a local development origin", () => {
    expect(validateOptionalGatewayUrl("GATEWAY", "http://127.0.0.1:8787", false)).toBe(
      "http://127.0.0.1:8787",
    );
    expect(() => validateOptionalGatewayUrl("GATEWAY", "http://api.example.test", false)).toThrow(
      "must use https outside local development",
    );
    expect(() => validateOptionalGatewayUrl("GATEWAY", "http://localhost:8787", true)).toThrow(
      "must use https outside local development",
    );
  });

  it("rejects malformed URLs and origins with path, credentials, query, or fragment", () => {
    expect(() => validateOptionalGatewayUrl("GATEWAY", "not-a-url")).toThrow("Invalid URL");
    for (const value of [
      "https://user:pass@api.example.test",
      "https://api.example.test/path",
      "https://api.example.test?key=value",
      "https://api.example.test#fragment",
    ]) {
      expect(() => validateOptionalGatewayUrl("GATEWAY", value)).toThrow("must be an origin URL");
    }
  });

  it("fails closed when preview Supabase values are missing or target production", () => {
    const productionUrl = "https://production-project.supabase.co";
    expect(() =>
      resolveEnvironmentScopedPublicValue({
        appEnv: "preview",
        explicitValue: "",
        fallback: productionUrl,
        name: "EXPO_PUBLIC_SUPABASE_URL",
      }),
    ).toThrow("Missing required preview environment variable");
    expect(() =>
      resolveEnvironmentScopedPublicValue({
        appEnv: "preview",
        explicitValue: `${productionUrl}/`,
        fallback: productionUrl,
        forbiddenNonProductionValues: [productionUrl],
        name: "EXPO_PUBLIC_SUPABASE_URL",
      }),
    ).toThrow("must target an isolated preview environment");
    expect(() =>
      resolveEnvironmentScopedPublicValue({
        appEnv: "preview",
        explicitValue: "https://PRODUCTION-PROJECT.supabase.co:443/path?alias=true",
        fallback: productionUrl,
        forbiddenNonProductionValues: [productionUrl],
        name: "EXPO_PUBLIC_SUPABASE_URL",
      }),
    ).toThrow("must target an isolated preview environment");
  });

  it("requires explicit isolated development/preview values and preserves production fallback", () => {
    expect(
      resolveEnvironmentScopedPublicValue({
        appEnv: "preview",
        explicitValue: "https://preview-project.supabase.co",
        fallback: "https://production-project.supabase.co",
        forbiddenNonProductionValues: ["https://production-project.supabase.co"],
        name: "EXPO_PUBLIC_SUPABASE_URL",
      }),
    ).toBe("https://preview-project.supabase.co");
    expect(() =>
      resolveEnvironmentScopedPublicValue({
        appEnv: "development",
        explicitValue: "",
        fallback: "production-value",
        forbiddenNonProductionValues: ["production-value"],
        name: "VALUE",
      }),
    ).toThrow("Missing required development environment variable");
    expect(() =>
      resolveEnvironmentScopedPublicValue({
        appEnv: "development",
        explicitValue: "production-value",
        fallback: "production-value",
        forbiddenNonProductionValues: ["production-value"],
        name: "VALUE",
      }),
    ).toThrow("must target an isolated development environment");
    expect(
      resolveEnvironmentScopedPublicValue({
        appEnv: "development",
        explicitValue: "development-value",
        fallback: "production-value",
        forbiddenNonProductionValues: ["production-value"],
        name: "VALUE",
      }),
    ).toBe("development-value");
    expect(
      resolveEnvironmentScopedPublicValue({
        appEnv: "production",
        explicitValue: "",
        fallback: "production-value",
        name: "VALUE",
      }),
    ).toBe("production-value");
  });

  it("requires a canonical isolated Supabase project and matching Functions endpoint", () => {
    const previewOrigin = validateSupabaseProjectUrl(
      "SUPABASE_URL",
      "https://abcdefghijklmnopqrst.supabase.co/",
      "preview",
      "productionprojectref",
    );
    expect(previewOrigin).toBe("https://abcdefghijklmnopqrst.supabase.co");
    expect(
      validateSupabaseFunctionsBaseUrl(
        "FUNCTIONS_URL",
        `${previewOrigin}/functions/v1/server/make-server-e3557d40/`,
        previewOrigin,
        "preview",
      ),
    ).toBe(`${previewOrigin}/functions/v1/server/make-server-e3557d40`);

    for (const value of [
      "https://custom-preview.example.test",
      "https://productionprojectref.supabase.co",
      "https://user:pass@abcdefghijklmnopqrst.supabase.co",
      "https://abcdefghijklmnopqrst.supabase.co/path",
      "https://abcdefghijklmnopqrst.supabase.co?target=preview",
    ]) {
      expect(() =>
        validateSupabaseProjectUrl("SUPABASE_URL", value, "preview", "productionprojectref"),
      ).toThrow();
    }
    expect(() =>
      validateSupabaseFunctionsBaseUrl(
        "FUNCTIONS_URL",
        "https://differentprojectrefx.supabase.co/functions/v1/server/make-server-e3557d40",
        previewOrigin,
        "preview",
      ),
    ).toThrow("must target the configured Supabase project");

    expect(
      validateSupabaseProjectUrl(
        "SUPABASE_URL",
        "https://PRODUCTIONPROJECTREF.supabase.co:443/",
        "production",
        "productionprojectref",
      ),
    ).toBe("https://productionprojectref.supabase.co");
    expect(() =>
      validateSupabaseProjectUrl(
        "SUPABASE_URL",
        "https://evil.example.test",
        "production",
        "productionprojectref",
      ),
    ).toThrow("must target the configured production Supabase project");

    expect(
      validateSupabaseProjectUrl(
        "SUPABASE_URL",
        "http://127.0.0.1:58321",
        "development",
        "productionprojectref",
      ),
    ).toBe("http://127.0.0.1:58321");
    expect(
      validateSupabaseProjectUrl(
        "SUPABASE_URL",
        "https://abcdefghijklmnopqrst.supabase.co",
        "development",
        "productionprojectref",
      ),
    ).toBe("https://abcdefghijklmnopqrst.supabase.co");
    for (const value of [
      "https://productionprojectref.supabase.co",
      "https://development-alias.example.test",
    ]) {
      expect(() =>
        validateSupabaseProjectUrl("SUPABASE_URL", value, "development", "productionprojectref"),
      ).toThrow("must target an isolated development Supabase project");
    }
  });

  it("requires and enforces a canonical production gateway deny target in preview", () => {
    const productionOrigin = "https://universe-edge-production.example.test";
    expect(() =>
      validateOptionalGatewayUrl(
        "GATEWAY",
        "https://universe-edge-preview.example.test",
        false,
        "preview",
      ),
    ).toThrow("Missing production Cloudflare gateway origin");
    expect(() =>
      validateOptionalGatewayUrl(
        "GATEWAY",
        "https://UNIVERSE-EDGE-PRODUCTION.example.test:443/",
        false,
        "preview",
        [productionOrigin],
      ),
    ).toThrow("must target an isolated preview gateway");
    expect(
      validateOptionalGatewayUrl(
        "GATEWAY",
        "https://universe-edge-preview.example.test/",
        false,
        "preview",
        [productionOrigin],
      ),
    ).toBe("https://universe-edge-preview.example.test");
    expect(() =>
      validateOptionalGatewayUrl(
        "GATEWAY",
        "http://universe-edge-preview.example.test",
        false,
        "preview",
        [productionOrigin],
      ),
    ).toThrow("must use https");
    expect(() =>
      validateOptionalGatewayUrl(
        "GATEWAY",
        "https://universe-edge-preview.example.test",
        false,
        "preview",
        ["http://api.production.example.test"],
      ),
    ).toThrow("must use https");
  });

  it("pins an enabled production gateway to its declared canonical origin", () => {
    expect(
      validateOptionalGatewayUrl("GATEWAY", "https://API.EXAMPLE.TEST:443/", true, "production", [
        "https://api.example.test",
      ]),
    ).toBe("https://api.example.test");
    expect(() =>
      validateOptionalGatewayUrl("GATEWAY", "https://evil.example.test", true, "production", [
        "https://api.example.test",
      ]),
    ).toThrow("must match the declared production gateway");
    expect(() =>
      validateOptionalGatewayUrl("GATEWAY", "https://api.example.test", true, "production"),
    ).toThrow("must match the declared production gateway");
  });
});
