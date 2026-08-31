jest.mock("./securityTelemetry", () => ({
  recordSecurityTelemetryEvent: jest.fn(),
}));

jest.mock("../config/runtime", () => ({
  APP_ENV: "production",
  APP_SCHEME: "ogrencisosyalagi",
  AUTH_VERIFICATION_BYPASS_ENABLED: false,
  IS_PRODUCTION_RUNTIME: true,
  RUNTIME_FLAGS: { disableLegacyEdgeReads: true },
}));

jest.mock("../config/publicEnv", () => ({
  CLOUDFLARE_GATEWAY_URL: "http://gateway.example.test",
  SUPABASE_FUNCTIONS_BASE_URL_VALIDATED: "https://example.supabase.co/functions/v1/server",
  SUPABASE_PUBLIC_URL_VALIDATED: "https://example.supabase.co",
}));

import { runRuntimeSecurityChecks } from "./runtimeSecurity";
import { recordSecurityTelemetryEvent } from "./securityTelemetry";

const mockRecordSecurityTelemetryEvent = recordSecurityTelemetryEvent as jest.Mock;

describe("runtime gateway security", () => {
  it("reports a non-HTTPS production gateway as a high-severity issue", async () => {
    const result = await runRuntimeSecurityChecks();

    expect(result.issues).toContainEqual({
      code: "cloudflare_gateway_url_not_https",
      severity: "high",
    });
    expect(mockRecordSecurityTelemetryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ result: "fail" }),
    );
  });
});
