import { getToken } from "./core.auth";
import { getRecoveredAccessToken } from "../supabase/authSession";

jest.mock("../config/publicEnv", () => ({ SUPABASE_PUBLIC_ANON_KEY: "anon-key" }));
jest.mock("../../platform/logging/logger", () => ({ debugLog: jest.fn() }));
jest.mock("../supabase", () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));
jest.mock("../supabase/authSession", () => ({ getRecoveredAccessToken: jest.fn() }));
jest.mock("../supabase/sessionRefresh", () => ({
  refreshSupabaseSessionSingleFlight: jest.fn(),
}));

describe("getToken required authentication", () => {
  it("fails closed when no recovered access token exists", async () => {
    (getRecoveredAccessToken as jest.Mock).mockResolvedValue(null);
    await expect(getToken({ requireAuth: true })).rejects.toThrow();
  });
});
