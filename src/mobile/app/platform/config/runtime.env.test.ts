describe("statically allowlisted Expo public environment", () => {
  const originalGatewayUrl = process.env.EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL;

  afterEach(() => {
    jest.resetModules();
    if (originalGatewayUrl === undefined) {
      delete process.env.EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL;
    } else {
      process.env.EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL = originalGatewayUrl;
    }
  });

  it("reads an allowlisted value and trims it", () => {
    process.env.EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL = "  https://api.example.test  ";
    jest.resetModules();

    const { readStringEnv } = require("./runtime") as typeof import("./runtime");

    expect(readStringEnv("EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL")).toBe("https://api.example.test");
  });

  it("fails closed to the caller fallback for unknown dynamic names", () => {
    jest.resetModules();
    const { readStringEnv } = require("./runtime") as typeof import("./runtime");

    expect(readStringEnv("EXPO_PUBLIC_NOT_ALLOWLISTED", "safe-default")).toBe("safe-default");
  });
});
