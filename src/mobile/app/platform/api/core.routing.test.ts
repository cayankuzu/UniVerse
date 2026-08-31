jest.mock("../config/publicEnv", () => ({
  CLOUDFLARE_GATEWAY_URL: "https://api.example.test",
  SUPABASE_FUNCTIONS_BASE_URL: "https://functions.example.test",
}));

import { isCloudflareGatewayRoute, resolveApiUrl } from "./core.routing";

describe("selective Cloudflare gateway routing", () => {
  it.each([
    ["GET", "/health"],
    ["GET", "/auth/check-email?email=user%40example.test"],
    ["GET", "/auth/check-username/student_1"],
    ["POST", "/auth/register-direct"],
    ["POST", "/auth/register"],
    ["POST", "/reports"],
    ["POST", "/storage/upload-session/create"],
    ["POST", "/storage/upload-session/finalize"],
    ["POST", "/storage/upload-session/cancel"],
  ])("routes %s %s through the gateway", (method, path) => {
    expect(isCloudflareGatewayRoute(method, path)).toBe(true);
    expect(resolveApiUrl(method, path)).toBe(`https://api.example.test${path}`);
  });

  it.each([
    ["POST", "/storage/upload"],
    ["POST", "/storage/upload-ticket"],
    ["GET", "/feed"],
    ["GET", "/users/me/follow-status"],
    ["GET", "/auth/check-username/ab"],
    ["GET", "/auth/check-username/Student_1"],
    ["GET", "/auth/check-username/student-name"],
    ["GET", "/auth/check-username/abcdefghijklmnopqrstuvwxy"],
    ["POST", "/auth/check-email"],
    ["DELETE", "/reports"],
  ])("keeps %s %s on the Supabase origin", (method, path) => {
    expect(isCloudflareGatewayRoute(method, path)).toBe(false);
    expect(resolveApiUrl(method, path)).toBe(`https://functions.example.test${path}`);
  });
});
