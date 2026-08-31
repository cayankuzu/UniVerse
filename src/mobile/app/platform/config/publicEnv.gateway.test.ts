import { URL as NodeUrl } from "node:url";

import { validateOptionalGatewayUrl } from "./publicEnv";

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
});
