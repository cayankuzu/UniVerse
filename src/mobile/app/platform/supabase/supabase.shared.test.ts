import {
  canApplyPasswordResetSession,
  isSupabaseAuthStorageKey,
  parseSupabaseDeepLink,
  resolveExpectedAuthFlow,
  shouldRejectSupabaseAuthPayload,
} from "./supabase.shared";

describe("supabase.shared", () => {
  it("parses trusted auth callback deep links", () => {
    const parsed = parseSupabaseDeepLink({
      appScheme: "ogrencisosyalagi",
      parseUrl: () => ({
        path: "auth/callback",
        queryParams: {
          code: "auth-code",
          flow: "signup",
          state: "state-1",
        },
        scheme: "ogrencisosyalagi",
      }),
      url: "ogrencisosyalagi://auth/callback?code=auth-code&flow=signup&state=state-1",
    });

    expect(parsed).toMatchObject({
      code: "auth-code",
      flow: "signup",
      hadAuthPayload: true,
      target: "AuthCallback",
      trustedDeepLink: true,
    });
  });

  it("rejects unexpected auth payloads when trust or tracking breaks", () => {
    expect(
      shouldRejectSupabaseAuthPayload({
        expectedFlow: resolveExpectedAuthFlow("AuthCallback"),
        flow: "signup",
        hadAuthPayload: true,
        target: "AuthCallback",
        trackedFlow: null,
        trackedRedirect: false,
        trustedDeepLink: true,
      }),
    ).toBe(true);
    expect(
      shouldRejectSupabaseAuthPayload({
        expectedFlow: resolveExpectedAuthFlow("AuthCallback"),
        flow: "signup",
        hadAuthPayload: true,
        target: "AuthCallback",
        trackedFlow: "signup",
        trackedRedirect: true,
        trustedDeepLink: true,
      }),
    ).toBe(false);
  });

  it("allows raw session tokens only for password reset deep links", () => {
    expect(
      canApplyPasswordResetSession({
        target: "ResetPassword",
        trackedFlow: "password-reset",
      }),
    ).toBe(true);
    expect(
      canApplyPasswordResetSession({
        target: "AuthCallback",
        trackedFlow: "signup",
      }),
    ).toBe(false);
  });

  it("matches Supabase auth storage keys consistently", () => {
    expect(isSupabaseAuthStorageKey("sb-project-auth-token", "project")).toBe(true);
    expect(isSupabaseAuthStorageKey("sb-project-auth-token-code-verifier", "project")).toBe(true);
    expect(isSupabaseAuthStorageKey("supabase.auth.token", "project")).toBe(true);
    expect(isSupabaseAuthStorageKey("random-cache-key", "project")).toBe(false);
  });
});
